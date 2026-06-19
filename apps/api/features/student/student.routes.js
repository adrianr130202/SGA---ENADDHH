import { Router } from 'express';
import { z } from 'zod';
import pool from '../../database/db.js'; // Importamos el pool de Postgres

const studentRouter = Router();

const createStudentSchema = z.object({
  cedula: z.string().regex(/^\d{8}$/, { message: 'La cédula debe tener exactamente 8 dígitos' }),
  fullName: z.string().min(7, { message: 'El nombre completo es demasiado corto' }),
  email: z.string().email({ message: 'Formato de correo electrónico inválido' }),
  phone: z.string().regex(/^(0412|0414|0416|0422|0424|0426)\d{7}$/, { message: 'Formato de teléfono inválido' }),
  courseId: z.number({ required_error: 'Debe seleccionar un diplomado válido' })
});

// REGISTRAR ESTUDIANTE (Con Hora Venezolana, Log de Actividad y Transacción PG)
studentRouter.post('/', async (req, res, next) => { 
  const client = await pool.connect(); // Cliente exclusivo para transacción
  try {
    const body = createStudentSchema.parse(req.body);
    const { cedula, fullName, email, phone, courseId } = body;

    const fechaVenezuela = new Date().toLocaleString("sv-SE", { timeZone: "America/Caracas" }).replace("T", " ");

    await client.query('BEGIN'); // Inicia Transacción

    await client.query(
      'INSERT INTO students (cedula, "fullName", email, phone, "createdAt") VALUES ($1, $2, $3, $4, $5)',
      [cedula, fullName, email, phone, fechaVenezuela]
    );

    await client.query(
      'INSERT INTO enrollments ("studentCedula", "courseId", status, "createdAt") VALUES ($1, $2, $3, $4)',
      [cedula, courseId, 'cursando', fechaVenezuela]
    );
      
    // Registro en la tabla de auditoría
    await client.query(
      'INSERT INTO activity_log (description, "createdAt") VALUES ($1, $2)',
      [`Se registró al estudiante ${fullName} en el sistema.`, fechaVenezuela]
    );

    await client.query('COMMIT'); // Confirma Transacción
    res.status(201).json({ message: 'Estudiante y matrícula creados con éxito' });

  } catch (error) {
    await client.query('ROLLBACK'); // Deshace si hay error
    
    // 23503 = Error de llave foránea en Postgres (Course no existe)
    if (error.code === '23503') {
      return res.status(400).json({ error: 'El diplomado seleccionado no existe.' });
    }
    // 23505 = Error de Unique en Postgres (Cédula o Email repetido)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un estudiante registrado con esa cédula o correo electrónico.' });
    }
    next(error);
  } finally {
    client.release(); // Libera el cliente
  }
});

// 2. BUSCAR ESTUDIANTES (Ocultando los eliminados con isActive = 1)
studentRouter.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    let result;

    if (search) {
      result = await pool.query(`
        SELECT s.*, c.name as "courseName" 
        FROM students s
        LEFT JOIN enrollments e ON s.cedula = e."studentCedula" AND e.status = 'cursando'
        LEFT JOIN courses c ON e."courseId" = c.id
        WHERE s.cedula ILIKE $1 AND s."isActive" = 1
        ORDER BY s."createdAt" DESC
      `, [`%${search}%`]); 
    } else {
      result = await pool.query(`
        SELECT s.*, c.name as "courseName" 
        FROM students s
        LEFT JOIN enrollments e ON s.cedula = e."studentCedula" AND e.status = 'cursando'
        LEFT JOIN courses c ON e."courseId" = c.id
        WHERE s."isActive" = 1
        ORDER BY s."createdAt" DESC
      `);
    }

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// 3. ESTADÍSTICAS GENERALES Y ACTIVIDAD RECIENTE 
studentRouter.get('/estadisticas', async (req, res, next) => {
  try {
    const estResult = await pool.query('SELECT COUNT(*) as total FROM students WHERE "isActive" = 1');
    const totalEstudiantes = Number(estResult.rows[0].total);

    const dipResult = await pool.query("SELECT COUNT(*) as total FROM courses WHERE status = 'active'");
    const totalDiplomados = Number(dipResult.rows[0].total);

    const inscResult = await pool.query('SELECT COUNT(*) as total FROM enrollments');
    const totalInscripciones = Number(inscResult.rows[0].total);
    
    // Mejorado: Solo cuenta certificados de alumnos activos
    const certResult = await pool.query(`
      SELECT COUNT(e.id) as total 
      FROM enrollments e
      JOIN students s ON e."studentCedula" = s.cedula
      WHERE s."isActive" = 1
        AND e.grade1 IS NOT NULL AND e.grade2 IS NOT NULL 
        AND e.grade3 IS NOT NULL AND e.grade4 IS NOT NULL
        AND ((e.grade1 + e.grade2 + e.grade3 + e.grade4) / 4.0) >= 10
    `);
    const totalCertificados = Number(certResult.rows[0].total);

    const demandaResult = await pool.query(`
      SELECT c.name, COUNT(e.id) as inscritos
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e."courseId"
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY inscritos DESC
      LIMIT 5
    `);
    
    const demandaCursos = demandaResult.rows.map(row => ({
      name: row.name,
      inscritos: Number(row.inscritos)
    }));

    const actividadResult = await pool.query(`
      SELECT description, "createdAt" 
      FROM activity_log 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `);
    
    res.status(200).json({
      contadores: {
        estudiantes: totalEstudiantes,
        diplomados: totalDiplomados,
        inscripciones: totalInscripciones,
        certificados: totalCertificados
      },
      grafico: demandaCursos,
      actividad: actividadResult.rows 
    });
  } catch (error) {
    next(error);
  }
});

// 4. CAMBIAR ESTUDIANTE DE DIPLOMADO (Con Log de Migración y Transacción)
studentRouter.post('/:cedula/cambiar-diplomado', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { cedula } = req.params;
    const { nuevoCourseId } = req.body;

    if (!nuevoCourseId) {
      return res.status(400).json({ error: 'Debe proporcionar el ID del nuevo diplomado.' });
    }

    const fechaVenezuela = new Date().toLocaleString("sv-SE", { timeZone: "America/Caracas" }).replace("T", " ");

    await client.query('BEGIN');

    await client.query(
      "UPDATE enrollments SET status = 'migrado' WHERE \"studentCedula\" = $1 AND status = 'cursando'",
      [cedula]
    );
      
    await client.query(
      'INSERT INTO enrollments ("studentCedula", "courseId", status, "createdAt") VALUES ($1, $2, $3, $4)',
      [cedula, nuevoCourseId, 'cursando', fechaVenezuela]
    );
        
    const estResult = await client.query('SELECT "fullName" FROM students WHERE cedula = $1', [cedula]);
    const cursoResult = await client.query('SELECT name FROM courses WHERE id = $1', [nuevoCourseId]);
      
    if (estResult.rowCount > 0 && cursoResult.rowCount > 0) {
      const estudiante = estResult.rows[0];
      const curso = cursoResult.rows[0];
      
      await client.query(
        'INSERT INTO activity_log (description, "createdAt") VALUES ($1, $2)',
        [`Se migró al alumno ${estudiante.fullName} al diplomado en ${curso.name}.`, fechaVenezuela]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Migración de diplomado exitosa' });

  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') { // 23503 = Error Foreign Key PG
      return res.status(400).json({ error: 'El diplomado seleccionado no es válido.' });
    }
    next(error);
  } finally {
    client.release();
  }
});

// 5. ACTUALIZAR ESTUDIANTE 
studentRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cedula, fullName, email, phone } = req.body;

    const result = await pool.query(`
      UPDATE students 
      SET cedula = $1, "fullName" = $2, email = $3, phone = $4 
      WHERE id = $5
    `, [cedula, fullName, email, phone, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    res.status(200).json({ message: 'Estudiante actualizado con éxito' });
  } catch (error) {
    next(error);
  }
});

// ELIMINAR ESTUDIANTE (Soft Delete y Log de Baja)
studentRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const fechaVenezuela = new Date().toLocaleString("sv-SE", { timeZone: "America/Caracas" }).replace("T", " ");

    const estResult = await pool.query('SELECT "fullName" FROM students WHERE id = $1', [id]);
    const estudiante = estResult.rows[0];

    const updateResult = await pool.query('UPDATE students SET "isActive" = 0 WHERE id = $1', [id]);

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    if (estudiante) {
      await pool.query(
        'INSERT INTO activity_log (description, "createdAt") VALUES ($1, $2)',
        [`Se dio de baja al estudiante ${estudiante.fullName} del sistema.`, fechaVenezuela]
      );
    }

    res.status(200).json({ message: 'Estudiante dado de baja con éxito' });
  } catch (error) {
    next(error);
  }
});

export default studentRouter;