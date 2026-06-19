import { Router } from 'express';
import { authenticate } from '../auth/auth.middlewares.js';
import pool from '../../database/db.js'; // Importamos el pool de Postgres

const enrollmentRouter = Router();

// GET: Obtener lista de alumnos por curso (ACTUALIZADO PARA 4 MÓDULOS Y POSTGRES)
enrollmentRouter.get('/course/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        e.id as "enrollmentId", 
        s.cedula, 
        s."fullName", 
        s.email, 
        e.grade1, 
        e.grade2, 
        e.grade3, 
        e.grade4, 
        e.status
      FROM enrollments e
      JOIN students s ON e."studentCedula" = s.cedula
      WHERE e."courseId" = $1 AND s."isActive" = 1
    `, [courseId]);

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET: Obtener lista de alumnos aprobados para emisión de certificados
enrollmentRouter.get('/approved', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id as "enrollmentId", 
        s.cedula, 
        s."fullName", 
        c.name as "courseName",
        ((COALESCE(e.grade1, 0) + COALESCE(e.grade2, 0) + COALESCE(e.grade3, 0) + COALESCE(e.grade4, 0)) / 4.0) as "finalGrade"
      FROM enrollments e
      JOIN students s ON e."studentCedula" = s.cedula
      JOIN courses c ON e."courseId" = c.id
      WHERE s."isActive" = 1 
        AND e.grade1 IS NOT NULL AND e.grade2 IS NOT NULL 
        AND e.grade3 IS NOT NULL AND e.grade4 IS NOT NULL
        AND ((e.grade1 + e.grade2 + e.grade3 + e.grade4) / 4.0) >= 10
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET: Obtener el historial completo de inscripciones
enrollmentRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT e.*, s."fullName", c.name as "courseName" 
      FROM enrollments e
      JOIN students s ON e."studentCedula" = s.cedula
      JOIN courses c ON e."courseId" = c.id
      WHERE s."isActive" = 1
      ORDER BY e."createdAt" DESC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// PUT: Actualizar el estado (cursando, congelado, retirado)
enrollmentRouter.put('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query('UPDATE enrollments SET status = $1 WHERE id = $2', [status, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Inscripción no encontrada.' });
    }

    res.status(200).json({ message: 'Estado actualizado correctamente.' });
  } catch (error) {
    next(error);
  }
});

// PUT: Cargar o actualizar las notas (4 módulos) de un alumno específico
enrollmentRouter.put('/:id/grades', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { grade1, grade2, grade3, grade4 } = req.body;

    const isValidGrade = (g) => g === null || (typeof g === 'number' && g >= 0 && g <= 20);

    if (!isValidGrade(grade1) || !isValidGrade(grade2) || !isValidGrade(grade3) || !isValidGrade(grade4)) {
      return res.status(400).json({ error: 'Las calificaciones deben estar estrictamente entre 0 y 20 puntos.' });
    }

    const result = await pool.query(`
      UPDATE enrollments 
      SET grade1 = $1, grade2 = $2, grade3 = $3, grade4 = $4
      WHERE id = $5
    `, [grade1, grade2, grade3, grade4, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Inscripción no encontrada en la base de datos.' });
    }

    res.status(200).json({ message: 'Calificaciones guardadas con éxito.' });
  } catch (error) {
    next(error);
  }
});

export default enrollmentRouter;