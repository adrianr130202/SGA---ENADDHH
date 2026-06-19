import db from '../../database/db.js';

const enrollmentRepository = {
  // obtener los estudiantes inscritos en un diplomado específico junto con su nota actual
  getStudentsWithGrades(courseId) {
    return db.prepare(`
      SELECT e.id as enrollmentId, s.cedula, s.fullName, e.grade, e.status
      FROM enrollments e
      JOIN students s ON e.studentCedula = s.cedula
      WHERE e.courseId = ?
      ORDER BY s.fullName ASC
    `).all(courseId);
  },

  // actualizar la calificación de una inscripción
  updateGrade(enrollmentId, grade) {
    const stmt = db.prepare('UPDATE enrollments SET grade = ? WHERE id = ?');
    return stmt.run(grade, enrollmentId);
  },

  //  Obtener solo los estudiantes APROBADOS (Nota >= 10) para certificados
  getApprovedEnrollments() {
    return db.prepare(`
      SELECT e.id as enrollmentId, s.cedula, s.fullName, c.name as courseName, e.grade, e.createdAt as fechaAprobacion
      FROM enrollments e
      JOIN students s ON e.studentCedula = s.cedula
      JOIN courses c ON e.courseId = c.id
      WHERE e.grade >= 10
      ORDER BY c.name ASC, s.fullName ASC
    `).all();
  },

  //  Obtener TODAS las inscripciones (Historial general)
  getAllEnrollments() {
    return db.prepare(`
      SELECT e.id as enrollmentId, s.cedula, s.fullName, c.name as courseName, e.status, e.grade, e.createdAt
      FROM enrollments e
      JOIN students s ON e.studentCedula = s.cedula
      JOIN courses c ON e.courseId = c.id
      ORDER BY e.createdAt DESC
    `).all();
  },

  //  Actualizar el ESTADO administrativo de una inscripción
  updateStatus(enrollmentId, status) {
    const stmt = db.prepare('UPDATE enrollments SET status = ? WHERE id = ?');
    return stmt.run(status, enrollmentId);
  }
};
export default enrollmentRepository;