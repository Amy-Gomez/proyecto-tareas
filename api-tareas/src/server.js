/**
 * Composición y arranque: Express, Socket.IO, y MongoDB.
 * Evento en tiempo real: "tarea:cambio" con { accion, datos, ocurridoEn }.
 */
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { Server } = require('socket.io');
const { conectar, desconectar, repositorio, crearAlmacen } = require('./repositorio');
const { crearServicio } = require('./servicio');
const { crearRutas } = require('./rutas');
const { rutaNoEncontrada, manejadorErrores } = require('./errores');

const crearServidor = async ({ mongoUri, dirAdjuntos }) => {
  await conectar(mongoUri);

  const app = express();
  const servidor = http.createServer(app);
  const io = new Server(servidor);

  const servicio = crearServicio({
    repositorio,
    almacen: crearAlmacen(dirAdjuntos),
    notificar: (evento) => io.emit('tarea:cambio', evento)
  });

  app.disable('x-powered-by');
  app.set('etag', false); // el único ETag es la versión de la tarea
  app.use(express.json({ limit: '10kb' }));
  app.use('/api/tareas', crearRutas(servicio));
  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);

  return {
    iniciar: (puerto) => new Promise((ok) => servidor.listen(puerto, () => ok(servidor.address().port))),
    detener: async () => { await io.close(); await desconectar(); }
  };
};

if (require.main === module) {
  crearServidor({
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/api_tareas',
    dirAdjuntos: process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads')
  })
    .then((s) => s.iniciar(Number(process.env.PORT) || 3000))
    .then((puerto) => console.log(`API de tareas en http://localhost:${puerto}`))
    .catch((err) => { console.error('No se pudo iniciar:', err.message); process.exit(1); });
}

module.exports = { crearServidor };
