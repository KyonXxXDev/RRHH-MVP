# Sistema Web HRMS — Plan de Implementación

## Descripción General

Sistema de Gestión de Recursos Humanos (HRMS) completo, basado en tecnologías web modernas con arquitectura cliente-servidor. Incluye autenticación con roles, 9 módulos funcionales completos, gráficos interactivos, exportación de reportes y diseño corporativo responsivo listo para producción.

---

## Decisiones de Arquitectura

### Stack Tecnológico

| Capa | Tecnología | Razón |
|------|------------|-------|
| **Frontend** | HTML5 + CSS3 Vanilla + JavaScript ES6+ | Sin dependencias externas, control total, máxima compatibilidad |
| **Gráficos** | Chart.js (CDN) | Librería ligera y madura para KPIs |
| **Iconos** | Lucide Icons (CDN) | Iconos modernos y limpios tipo ERP |
| **PDF Export** | jsPDF (CDN) | Generación de PDF en el cliente |
| **Excel Export** | SheetJS/XLSX (CDN) | Exportación a Excel |
| **Backend / DB** | Node.js + Express + SQLite (mejor-sqlite3) | Simple, sin instalación de servidor DB, ideal para demo y producción inicial |
| **Autenticación** | JWT + bcryptjs | Estándar de la industria |

> [!NOTE]
> La elección de SQLite permite que el sistema sea completamente autónomo (sin necesidad de instalar PostgreSQL/MySQL). Para escalar a producción grande, la base de datos puede migrarse fácilmente a PostgreSQL.

---

## Estructura del Proyecto

```
RRHH/
├── backend/
│   ├── server.js              # Servidor principal Express
│   ├── database.js            # Inicialización SQLite + seed data
│   ├── package.json
│   ├── routes/
│   │   ├── auth.js
│   │   ├── employees.js
│   │   ├── attendance.js
│   │   ├── permissions.js
│   │   ├── vacations.js
│   │   ├── licenses.js
│   │   └── reports.js
│   └── middleware/
│       └── auth.js            # JWT middleware
└── frontend/
    ├── index.html             # Login page
    ├── app.html               # Main SPA shell
    ├── css/
    │   ├── main.css           # Design system + tokens
    │   ├── layout.css         # Sidebar + layout
    │   ├── components.css     # Cards, tables, forms, badges
    │   └── animations.css     # Micro-animations
    ├── js/
    │   ├── app.js             # Router + state management
    │   ├── api.js             # API client (fetch wrapper)
    │   ├── auth.js            # Auth logic
    │   ├── utils.js           # Formatters, helpers
    │   └── modules/
    │       ├── dashboard.js
    │       ├── employees.js
    │       ├── attendance.js
    │       ├── permissions.js
    │       ├── vacations.js
    │       ├── licenses.js
    │       ├── legajo.js
    │       └── reports.js
    └── assets/
        └── logo.svg
```

---

## Módulos y Funcionalidades

### 1. Autenticación
- Login con email/contraseña
- JWT almacenado en localStorage
- 4 roles: Administrador, RRHH, Jefe, Colaborador
- Protección de rutas por rol
- Seed de usuarios demo

### 2. Dashboard (KPIs)
- 7 tarjetas con contadores animados
- Gráfico de asistencia semanal (barras)
- Gráfico de distribución de áreas (dona)
- Gráfico de tendencia de tardanzas (línea)
- Filtros por fecha y área

### 3. Gestión de Colaboradores
- CRUD completo con modal
- Filtros por área, cargo, estado
- Buscador en tiempo real
- Tabla paginada
- Historial laboral inline

### 4. Control de Asistencia
- Registrar entrada/salida con timestamp
- Cálculo automático de tardanzas (hora base: 08:00)
- Registro de horas extras
- Tabla con filtros por colaborador/fecha
- Exportar a Excel y PDF

### 5. Tardanzas y Faltas
- Vista consolidada de incidencias
- Clasificación automática
- Descuentos calculados
- Alertas y notificaciones badge

### 6. Permisos
- Formulario de solicitud (tipo, fecha, motivo)
- Flujo: Pendiente → Jefe → RRHH → Aprobado/Rechazado
- Bandeja de aprobación por rol
- Notificaciones en sidebar

### 7. Vacaciones
- Saldo de días disponibles por colaborador
- Solicitud con rango de fechas
- Validación de solapamiento
- Calendario visual

### 8. Licencias y Descansos Médicos
- Tipos: licencia médica, maternidad, paternidad, estudio
- Adjuntar número de documento
- Estados y seguimiento

### 9. Legajo Digital
- Perfil completo del colaborador
- Documentos listados (simulados)
- Historial de cambios de cargo/área
- Timeline visual

### 10. Reportes
- Asistencia mensual (tabla + gráfico)
- Ausentismo por área
- Tardanzas acumuladas
- Horas extras
- Dashboard ejecutivo
- Exportar todo en PDF o Excel

---

## Diseño Visual

- **Colores primarios**: `#0A2D63` (azul corporativo), blanco `#FFFFFF`, gris `#F5F7FA`
- **Acento**: `#1E90FF`, alertas `#E63946`, éxito `#2DC653`
- **Tipografía**: Inter (Google Fonts)
- **Sidebar**: 260px, collapsible en mobile
- **Tarjetas**: sombra suave, bordes redondeados 12px
- **Tablas**: header sticky, hover row, stripes
- **Modales**: overlay oscuro, slide-in animation
- **Badges**: colores por estado (pendiente/aprobado/rechazado)
- **Gráficos**: Chart.js con paleta corporativa

---

## Plan de Ejecución

### Fase 1 — Backend (Node.js + SQLite)
1. `package.json` con dependencias
2. `database.js` con schema + seed data
3. `server.js` + middleware JWT
4. Rutas: auth, employees, attendance, permissions, vacations, licenses, reports

### Fase 2 — Frontend Core
5. `index.html` (Login)
6. `app.html` (Shell con sidebar)
7. Design system CSS (tokens, componentes)
8. `app.js` (Router SPA)
9. `api.js` (cliente HTTP)

### Fase 3 — Módulos Frontend
10. Dashboard con Chart.js
11. Empleados CRUD
12. Asistencia
13. Tardanzas/Faltas
14. Permisos (con flujo de aprobación)
15. Vacaciones
16. Licencias
17. Legajo
18. Reportes + exportación

### Fase 4 — Pulido
19. Responsive mobile/tablet
20. Animaciones y micro-interacciones
21. README con instrucciones de arranque

---

## Verificación

- `npm install` + `npm start` en `/backend`
- Abrir `frontend/index.html` o servir con `npx serve`
- Login con usuarios demo seed
- Probar cada módulo con cada rol

---

## Usuarios Demo (seed)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@empresa.com | Admin123! | Administrador |
| rrhh@empresa.com | RRHH123! | Recursos Humanos |
| jefe@empresa.com | Jefe123! | Jefe |
| colaborador@empresa.com | Colab123! | Colaborador |
