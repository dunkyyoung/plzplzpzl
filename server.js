const express = require("express");
const mysql = require("mysql2/promise");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret: "vodit_rf_secret_key",
    resave: false,
    saveUninitialized: false
}));

const pool = mysql.createPool({
    host: "localhost",
    user: "admin",
    password: "",
    database: "vodit_rf",
    waitForConnections: true,
    connectionLimit: 10
});

function requireUser(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.admin) {
        return res.redirect("/login");
    }
    next();
}

app.get("/", (req, res) => {
    res.render("index", {
        user: req.session.user,
        admin: req.session.admin
    });
});

app.get("/register", (req, res) => {
    res.render("register", {
        error: null,
        success: null
    });
});

app.post("/register", async (req, res) => {
    try {
        const { full_name, birth_date, phone, email, login, password } = req.body;

        if (!full_name || !birth_date || !phone || !email || !login || !password) {
            return res.render("register", { error: "Заполните все поля", success: null });
        }

        const loginRegex = /^[A-Za-z0-9]{6,}$/;
        if (!loginRegex.test(login)) {
            return res.render("register", {
                error: "Логин должен содержать латинские буквы и цифры, минимум 6 символов",
                success: null
            });
        }

        if (password.length < 8) {
            return res.render("register", { error: "Пароль должен быть не менее 8 символов", success: null });
        }

        const [existingUsers] = await pool.query("SELECT * FROM users WHERE login = ?", [login]);
        if (existingUsers.length > 0) {
            return res.render("register", { error: "Такой логин уже существует", success: null });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (full_name, birth_date, phone, email, login, password)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [full_name, birth_date, phone, email, login, hashedPassword]
        );

        res.render("register", { error: null, success: "Регистрация прошла успешно. Теперь войдите в систему." });
    } catch (error) {
        res.render("register", { error: "Ошибка регистрации", success: null });
    }
});

app.get("/login", (req, res) => {
    res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
    try {
        const { login, password } = req.body;

        if (login === "Admin26" && password === "Demo20") {
            req.session.admin = { login: "Admin26" };
            return res.redirect("/admin");
        }

        const [users] = await pool.query("SELECT * FROM users WHERE login = ?", [login]);
        if (users.length === 0) {
            return res.render("login", { error: "Неверный логин или пароль" });
        }

        const user = users[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.render("login", { error: "Неверный логин или пароль" });
        }

        req.session.user = {
            user_id: user.user_id,
            full_name: user.full_name,
            login: user.login
        };

        res.redirect("/cabinet");
    } catch (error) {
        res.render("login", { error: "Ошибка авторизации" });
    }
});

app.get("/cabinet", requireUser, async (req, res) => {
    const [applications] = await pool.query(
        `SELECT a.application_id, a.banquet_type,
                DATE_FORMAT(a.start_date, '%d.%m.%Y') AS start_date,
                a.payment_method, a.status, a.created_at,
                r.review_text
         FROM applications a
         LEFT JOIN reviews r ON a.application_id = r.application_id
         WHERE a.user_id = ?
         ORDER BY a.created_at DESC`,
        [req.session.user.user_id]
    );

    res.render("cabinet", { user: req.session.user, applications });
});

app.get("/application", requireUser, (req, res) => {
    res.render("application", { error: null, success: null });
});

app.post("/application", requireUser, async (req, res) => {
    try {
        const { banquet_type, start_date, payment_method } = req.body;

        if (!banquet_type || !start_date || !payment_method) {
            return res.render("application", { error: "Заполните все поля", success: null });
        }

        await pool.query(
            `INSERT INTO applications (user_id, banquet_type, start_date, payment_method, status)
             VALUES (?, ?, ?, ?, 'Новая')`,
            [req.session.user.user_id, banquet_type, start_date, payment_method]
        );

        res.render("application", { error: null, success: "Заявка успешно отправлена администратору" });
    } catch (error) {
        res.render("application", { error: "Ошибка создания заявки", success: null });
    }
});

app.post("/review", requireUser, async (req, res) => {
    try {
        const { application_id, review_text } = req.body;

        const [applications] = await pool.query(
            `SELECT * FROM applications
             WHERE application_id = ? AND user_id = ? AND status = 'Обучение завершено'`,
            [application_id, req.session.user.user_id]
        );

        if (applications.length === 0) return res.redirect("/cabinet");

        const [existingReviews] = await pool.query(
            "SELECT * FROM reviews WHERE application_id = ?",
            [application_id]
        );

        if (existingReviews.length > 0) return res.redirect("/cabinet");

        await pool.query(
            `INSERT INTO reviews (application_id, user_id, review_text)
             VALUES (?, ?, ?)`,
            [application_id, req.session.user.user_id, review_text]
        );

        res.redirect("/cabinet");
    } catch (error) {
        res.redirect("/cabinet");
    }
});

app.get("/admin", requireAdmin, async (req, res) => {
    const [applications] = await pool.query(
        `SELECT a.application_id, u.full_name, u.phone, u.email, a.banquet_type,
                DATE_FORMAT(a.start_date, '%d.%m.%Y') AS start_date,
                a.payment_method, a.status, a.created_at, r.review_text
         FROM applications a
         JOIN users u ON a.user_id = u.user_id
         LEFT JOIN reviews r ON a.application_id = r.application_id
         ORDER BY a.created_at DESC`
    );

    res.render("admin", { applications });
});

app.post("/admin/status", requireAdmin, async (req, res) => {
    const { application_id, status } = req.body;
    await pool.query("UPDATE applications SET status = ? WHERE application_id = ?", [status, application_id]);
    res.redirect("/admin");
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.listen(3000, () => {
    console.log("Сервер запущен: http://localhost:3000");
});
