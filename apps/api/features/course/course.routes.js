import { Router } from 'express';
import { authenticate } from '../auth/auth.middlewares.js';
import pool from '../../database/db.js'; //  Importamos el pool de Postgres

const courseRouter = Router();

// GET: Listar todos los diplomados ACTIVOS
courseRouter.get('/', authenticate, async (req, res, next) => { // Función async
  try {
    //  await pool.query y leemos de .rows
    const result = await pool.query("SELECT * FROM courses WHERE status = 'active' ORDER BY \"createdAt\" DESC");
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST: Crear nuevo diplomado (ACTUALIZADO CON LOG Y TRANSACCIÓN POSTGRES)
courseRouter.post('/', authenticate, async (req, res, next) => {
  const client = await pool.connect(); // <-- Abrimos conexión dedicada para transacción
  try {
    const { name, description } = req.body;
    const fechaVenezuela = new Date().toLocaleString("sv-SE", { timeZone: "America/Caracas" }).replace("T", " ");
    
    await client.query('BEGIN'); // <-- Iniciamos Transacción

    //  Parámetros $1, $2 y RETURNING id para obtener el ID recién creado
    const insertResult = await client.query(
      "INSERT INTO courses (name, description, status) VALUES ($1, $2, 'active') RETURNING id",
      [name, description || '']
    );
    const newId = insertResult.rows[0].id;

    // Registramos en el log
    await client.query(
      'INSERT INTO activity_log (description, "createdAt") VALUES ($1, $2)',
      [`Se creó el diplomado en "${name}" para la oferta académica.`, fechaVenezuela]
    );

    await client.query('COMMIT'); // <-- Confirmamos Transacción
    res.status(201).json({ id: newId, name, description });

  } catch (error) {
    await client.query('ROLLBACK'); // Si algo falla, deshacemos todo
    if (error.code === '23505') { //  Código de error UNIQUE en Postgres
      return res.status(400).json({ error: 'Ya existe un diplomado con ese nombre.' });
    }
    next(error);
  } finally {
    client.release(); // Liberamos la conexión de vuelta al pool
  }
});

// PUT: Editar diplomado (ACTUALIZADO CON LOG)
courseRouter.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const fechaVenezuela = new Date().toLocaleString("sv-SE", { timeZone: "America/Caracas" }).replace("T", " ");
    
    const updateResult = await pool.query(
      'UPDATE courses SET name = $1, description = $2 WHERE id = $3',
      [name, description || '', id]
    );
    
    //  Usamos rowCount en lugar de info.changes
    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Diplomado no encontrado' });
    }
    
    // Si se actualizó correctamente, registramos el evento
    await pool.query(
      'INSERT INTO activity_log (description, "createdAt") VALUES ($1, $2)',
      [`Se actualizaron los datos del diplomado "${name}".`, fechaVenezuela]
    );
    
    res.status(200).json({ message: 'Diplomado actualizado con éxito' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un diplomado con ese nombre.' });
    }
    next(error);
  }
});

// GET: Obtener alumnos inscritos en un diplomado (Para la lista de Asistencia)
courseRouter.get('/:id/students', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Nota: Las columnas con mayúsculas van entre comillas en Postgres ("fullName", "studentCedula", etc.)
    const result = await pool.query(`
      SELECT s.cedula, s."fullName", s.email, s.phone 
      FROM enrollments e
      JOIN students s ON e."studentCedula" = s.cedula
      WHERE e."courseId" = $1 AND s."isActive" = 1
      ORDER BY s."fullName" ASC
    `, [id]);
    
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// DELETE: Eliminar un diplomado (Soft Delete ACTUALIZADO CON LOG)
courseRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const fechaVenezuela = new Date().toLocaleString("sv-SE", { timeZone: "America/Caracas" }).replace("T", " ");

    // Guardamos el nombre del curso antes de ocultarlo para el log
    const cursoResult = await pool.query('SELECT name FROM courses WHERE id = $1', [id]);
    const curso = cursoResult.rows[0]; // Obtenemos la primera fila

    const deleteResult = await pool.query("UPDATE courses SET status = 'inactive' WHERE id = $1", [id]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Diplomado no encontrado.' });
    }

    if (curso) {
      await pool.query(
        'INSERT INTO activity_log (description, "createdAt") VALUES ($1, $2)',
        [`Se eliminó el diplomado "${curso.name}" de la oferta académica.`, fechaVenezuela]
      );
    }

    res.status(200).json({ message: 'Diplomado eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
});

export default courseRouter;