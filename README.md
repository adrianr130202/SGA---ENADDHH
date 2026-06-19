# 🎓 Sistema de Gestión Académica (SGA) - ENADDHH
Plataforma web integral desarrollada para la administración de procesos académicos, matriculación y control de calificaciones. Construida con una arquitectura moderna que separa el Frontend (Astro) y una API RESTful (Node.js/Express) conectada a la nube.

## 🚀 Características Principales

* **Gestión de Matrículas:** Registro y control de estados académicos de los estudiantes (Cursando, Congelado, Retirado, Finalizado).
* **Control de Calificaciones en Tiempo Real:** Interfaz dinámica para la carga de notas modulares con cálculo automático de promedios.
* **Generación Dinámica de Documentos:** Motor integrado para emitir y descargar certificados en formato `.docx` (Microsoft Word) inyectando datos directamente desde el navegador usando `docxtemplater` y `PizZip`.
* **Seguridad y Autenticación:** Sistema de login para administradores protegido con JSON Web Tokens (JWT) y cookies HttpOnly.
* **Base de Datos Cloud:** Migración y gestión de datos escalable utilizando PostgreSQL alojado en Supabase.

## 🛠️ Instalación y Configuración Local

1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/TU_USUARIO/sga-enaddhh.git](https://github.com/TU_USUARIO/sga-enaddhh.git)
   ```
