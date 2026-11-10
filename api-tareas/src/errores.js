/** Errores de aplicación y su formato uniforme: { error: { codigo, mensaje, detalles } } */
class AppError extends Error {
  constructor(estado, codigo, mensaje, detalles = []) {
    super(mensaje);
    Object.assign(this, { estado, codigo, detalles });
  }
}

const validacion = (detalles) => new AppError(400, 'VALIDACION', 'Los datos enviados no son válidos', detalles);
const archivoInvalido = (mensaje) => new AppError(400, 'ARCHIVO_INVALIDO', mensaje);
const noEncontrado = (recurso, id) => new AppError(404, 'NO_ENCONTRADO', `${recurso} con id '${id}' no existe`);
const duplicado = () =>
  new AppError(409, 'DUPLICADO', 'Ya existe una tarea con ese título', [{ campo: 'titulo', mensaje: 'debe ser único' }]);
const versionDesactualizada = (version) =>
  new AppError(409, 'CONFLICTO_VERSION', `La tarea fue modificada por otra petición; la versión ${version} ya no es la actual`,
    [{ campo: 'If-Match', mensaje: 'vuelve a obtener la tarea y reintenta con la versión vigente' }]);

/** Pura: convierte cualquier error en AppError. */
const aAppError = (err) => {
  if (err instanceof AppError) return err;
  if (err?.type === 'entity.parse.failed') return new AppError(400, 'JSON_INVALIDO', 'El cuerpo no es un JSON válido');
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    return new AppError(413, 'DEMASIADO_GRANDE', 'El cuerpo o archivo excede el tamaño permitido');
  }
  if (err?.name === 'MulterError') return archivoInvalido("Envía un único archivo en el campo 'archivo'");
  return new AppError(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado');
};

const formatear = ({ codigo, message, detalles }) => ({ error: { codigo, mensaje: message, detalles } });

const rutaNoEncontrada = (req, res, next) =>
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', `La ruta ${req.method} ${req.originalUrl} no existe`));


const manejadorErrores = (err, req, res, next) => {
  const e = aAppError(err);
  if (e.estado >= 500) console.error(err); 
  res.status(e.estado).json(formatear(e));
};

module.exports = {
  AppError, validacion, archivoInvalido, noEncontrado, duplicado, versionDesactualizada,
  rutaNoEncontrada, manejadorErrores
};
