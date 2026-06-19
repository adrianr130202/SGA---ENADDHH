import db from '../../database/db.js';

const studentRepository = {
  // Guarda el estudiante e inmediatamente crea su inscripción de forma atómica
  createStudentWithEnrollment({ cedula, fullName, email, phone, courseId }) {
    const runTransaction = db.transaction(() => {
      // 1. Insertar el perfil del estudiante
      const insertStudent = db.prepare(`
        INSERT INTO students (cedula, fullName, email, phone) 
        VALUES (?, ?, ?, ?)
      `);
      insertStudent.run(cedula, fullName, email, phone);

      // 2. Insertar la relación en la tabla puente 'enrollments'
      const insertEnrollment = db.prepare(`
        INSERT INTO enrollments (studentCedula, courseId) 
        VALUES (?, ?)
      `);
      insertEnrollment.run(cedula, courseId);
    });

    // Se ejecutan ambas consultas o ninguna
    runTransaction();

    return { cedula, fullName, email, phone, courseId };
  },

  // Obtener todos los estudiantes (Mantiene su lógica)
  getAllStudents() {
    return db.prepare('SELECT * FROM students ORDER BY createdAt DESC').all();
  },

  // Buscar estudiantes por coincidencia en la cédula (Mantiene su lógica)
  searchByCedula(cedula) {
    return db.prepare('SELECT * FROM students WHERE cedula LIKE ? ORDER BY createdAt DESC').all(`${cedula}%`);
  }
};

export default studentRepository;