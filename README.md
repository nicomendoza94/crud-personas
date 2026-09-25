# CRUD de personas con auditoría de búsquedas

Aplicación web para registrar y consultar personas (con imágenes de documento),
con verificación captcha antes de buscar, auditoría de cada búsqueda con IP real
y geolocalización, y notificación a un grupo de Telegram.

> ⚠️ Todos los datos e imágenes del sistema son **sintéticos**. No se cargan datos de personas reales.

## Requisitos previos
- Node.js 22 o superior
- PostgreSQL 16

## Instalación y ejecución
_(pendiente)_

## Arquitectura y stack
_(pendiente)_

## Almacenamiento de imágenes
_(pendiente)_

## Obtención de la IP del visitante
_(pendiente)_

## Captcha
_(pendiente)_

## Información enviada a Telegram
_(pendiente)_

## Fallas de APIs externas
_(pendiente)_

## Política de retención
_(pendiente)_

## Fuera de alcance y mejoras futuras
_(pendiente)_

## Uso de inteligencia artificial

Se utilizó Claude (Anthropic) como asistente durante el desarrollo.
Cada entrada registra en qué se usó, qué errores cometió la herramienta y qué se corrigió.

| Fecha | Parte del proyecto | Uso de la IA | Errores detectados / correcciones |
|-------|--------------------|--------------|-----------------------------------|
| 2026-09-24 | Planificación | Análisis de la consigna y propuesta de stack, arquitectura y decisiones de seguridad | Propuso `dotenv`; se reemplazó por `--env-file`, nativo de Node. La primera estructura no tenía capa de repositorios: el SQL iba a quedar mezclado con la lógica en los servicios. Se agregó `src/repositorios/` |
| 2026-09-24 | Arquitectura | Comparación entre MVC con EJS y API REST en capas | Se evaluaron ambas; se eligió API REST en capas por su separación de responsabilidades y su alineación con el mercado laboral actual |
| 2026-09-25 | Configuración inicial | Generación de `package.json` y archivos base | El `package.json` de ejemplo tenía versiones de dependencias anteriores a las instaladas; se conservaron las versiones reales de `package-lock.json` |
| 2026-09-25 | Documentación | Propuesta de ubicación de la bitácora de IA | La ubicó en un archivo aparte (`docs/uso-ia.md`), aunque la consigna pide documentarla en el README; se movió al README |