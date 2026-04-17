import { Database } from "bun:sqlite";
const db = new Database("sqlite.db");
// Resetăm balanța la 1000 și ne asigurăm că e admin
db.run("UPDATE users SET role = 'admin' WHERE username = 'orville.rau.pkdv8m.1'");
db.run("DELETE FROM bets WHERE userId = (SELECT id FROM users WHERE username = 'orville.rau.pkdv8m.1')");
console.log("Cont resetat: Balanță curată și drepturi de Admin!");