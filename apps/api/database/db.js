import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error crítico:', err.message);
  } else {
    console.log('¡Conectado exitosamente a PostgreSQL en Supabase!');
  }
  if (release) release();
});

export default pool;