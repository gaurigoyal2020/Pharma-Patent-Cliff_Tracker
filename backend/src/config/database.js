import knex from "knex";

const db = knex({
    client: 'pg',
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: {rejectUnauthorized: false}
    },
    pool : {
        min: 2,
        max: 10
    }
});

console.log("[DB] PostgreSQL via Superbase connected");

export default db;