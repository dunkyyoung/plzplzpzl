Информационная система «Банкетам.нет»
Node.js + Express + MySQL + EJS

Запуск:
1. Установить Node.js и MySQL.
2. Создать базу данных: выполнить файл db.sql в MySQL/phpMyAdmin.
3. В server.js проверить настройки MySQL:
   host: localhost
   user: root
   password: ""
   database: vodit_rf
4. В терминале открыть папку проекта.
5. Выполнить команды:
   npm install
   npm start
6. Открыть в браузере:
   http://localhost:3000

Администратор:
Логин: Admin26
Пароль: Demo20



в терминале сделай 
npm install


В файле server.js найди этот блок:
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "vodit_rf",
    waitForConnections: true,
    connectionLimit: 10
});


пароль поменяй



npm start
http://localhost:3000


