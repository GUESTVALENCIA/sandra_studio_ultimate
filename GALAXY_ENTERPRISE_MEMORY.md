# 🧠 GALAXY ENTERPRISE - MEMORIA DE SISTEMA & PROTOCOLO

> **PROYECTO:** SANDRA STUDIO ULTIMATE
> **ESTADO:** ACTIVO
> **NIVEL:** ENTERPRISE / PRODUCTION READY

## 🎯 Objetivo Global
Estandarización, limpieza profunda y despliegue seguro en arquitectura Vercel/Node.

## 👥 Roles del Equipo
- **CEO (Claytis):** Dirección estratégica.
- **Gemini (Local Ops):** Ejecución técnica, scripting PowerShell, saneamiento de código.
- **Jules (Remote Ops):** Gestión de repositorios, CI/CD pipelines.

## ⚙️ Workflow Estándar

### 🛠️ Fase 1: Mantenimiento (Script: `master-cleanup-workflow.ps1`)
1.  **Cuarentena:** Aislamiento de archivos corruptos.
2.  **Deep Clean:** Eliminación de `node_modules`, `.next`, `dist` y cachés.
3.  **Reset:** Preparación para `npm install` limpio.

### 🧹 Fase 2: Saneamiento (Script: `sanitize-code.ps1`)
1.  **Seguridad:** Verificación de headers en `vercel.json`.
2.  **Linting:** Eliminación automática de logs (`console.log`) en `api-gateway.js`.

### 🤝 Fase 3: Handoff (Script: `git-handoff.ps1`)
1.  Staging completo.

### 🚀 Ejecución Maestra
- **Script:** `deploy-complete.ps1` (Ejecuta Fase 1, 2 y 3 en secuencia).
2.  Commit estandarizado: `"feat(galaxy): enterprise upgrade & security hardening"`.

---
*Generado por Gemini Code Assist - Galaxy Enterprise Team*