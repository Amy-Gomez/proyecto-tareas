
const d = require('./dominio');
const { noEncontrado, versionDesactualizada, archivoInvalido } = require('./errores');

const crearServicio = ({ repositorio, almacen, notificar, reloj = () => new Date().toISOString() }) => {
  const avisar = (accion, datos) => notificar(d.crearEvento(accion, datos, reloj()));

  const exigir = (doc, recurso, id) => {
    if (!doc) throw noEncontrado(recurso, id);
    return doc;
  };

  /** Una escritura condicionada no coincidió: o no existe (404) o cambió la versión (409). */
  const explicarFallo = async (id, version) => {
    if (!(await repositorio.existe(id))) throw noEncontrado('Tarea', id);
    throw versionDesactualizada(version);
  };

  const editar = (preparar) => async (id, datos, version) => {
    const doc = (await repositorio.actualizar(id, preparar(datos), version)) ?? (await explicarFallo(id, version));
    const tarea = d.aDTO(doc);
    avisar('actualizada', tarea);
    return tarea;
  };

  return Object.freeze({
    listar: async (filtros) => (await repositorio.listar(d.construirFiltro(filtros))).map(d.aDTO),

    obtener: async (id) => d.aDTO(exigir(await repositorio.obtener(id), 'Tarea', id)),

    crear: async (datos) => {
      const tarea = d.aDTO(await repositorio.crear(d.datosCompletos(datos)));
      avisar('creada', tarea);
      return tarea;
    },

    reemplazar: editar(d.datosCompletos),
    actualizar: editar(d.datosParciales),

    eliminar: async (id, version) => {
      const doc = (await repositorio.eliminar(id, version)) ?? (await explicarFallo(id, version));
      await almacen.eliminar(doc.adjuntos.map((a) => a.nombreAlmacenado));
      avisar('eliminada', { id });
    },

    agregarAdjunto: async (id, archivo) => {
      const tipo = d.detectarTipo(archivo?.buffer);
      if (!tipo) throw archivoInvalido(`Tipo no permitido. Permitidos: ${d.TIPOS_PERMITIDOS.join(', ')}`);

      const nombreAlmacenado = await almacen.guardar(archivo.buffer, d.extensionDe(tipo));
      const adjunto = { nombreOriginal: d.sanearNombre(archivo.originalname), nombreAlmacenado, tipo, tamano: archivo.size };
      const doc = await repositorio.agregarAdjunto(id, adjunto);
      if (!doc) {
        await almacen.eliminar([nombreAlmacenado]); 
        throw noEncontrado('Tarea', id);
      }
      const creado = d.aDTO(doc).adjuntos.at(-1);
      avisar('adjunto-agregado', { tareaId: id, adjunto: creado });
      return creado;
    },

    obtenerAdjunto: async (id, adjuntoId) => {
      const doc = exigir(await repositorio.obtener(id), 'Tarea', id);
      const a = exigir(doc.adjuntos.find((x) => String(x._id) === adjuntoId), 'Adjunto', adjuntoId);
      return { ruta: almacen.ruta(a.nombreAlmacenado), nombre: a.nombreOriginal, tipo: a.tipo };
    }
  });
};

module.exports = { crearServicio };
