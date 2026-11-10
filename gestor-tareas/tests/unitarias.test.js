import { describe, it, expect, vi, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { api, ApiError } from '../src/services/api'
import { usePeticion } from '../src/composables/usePeticion'
import { validarTarea, diferencias, inicioMesActual } from '../src/utils/tareas'

const json = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.restoreAllMocks())

describe('servicio api', () => {
  it('devuelve los datos cuando response.ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { datos: [{ id: '1' }], total: 1 }))
    expect((await api.listar({ estado: '', buscar: 'x' })).datos).toEqual([{ id: '1' }])
    expect(fetch.mock.calls[0][0]).toBe('/api/tareas?buscar=x') // los filtros vacíos no se envían
  })

  it('convierte el error de la API en ApiError con errores por campo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(409, { error: { codigo: 'DUPLICADO', mensaje: 'Ya existe', detalles: [{ campo: 'titulo', mensaje: 'debe ser único' }] } }))
    const err = await api.crear({ titulo: 'abc' }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect([err.estado, err.codigo]).toEqual([409, 'DUPLICADO'])
    expect(err.erroresPorCampo).toEqual({ titulo: 'debe ser único' })
  })

  it('maneja 204 sin cuerpo, errores de red y respuestas no JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect((await api.eliminar('1', 0)).datos).toBeNull()
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect((await api.listar({}).catch((e) => e)).codigo).toBe('SIN_CONEXION')
    fetch.mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }))
    expect((await api.listar({}).catch((e) => e)).codigo).toBe('HTTP_502')
  })

  it('envía If-Match con la versión', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { datos: {} }))
    await api.actualizar('1', { estado: 'completada' }, 3)
    expect(fetch.mock.calls[0][1].headers['If-Match']).toBe('"3"')
  })
})

describe('usePeticion', () => {
  it('descarta la respuesta lenta de una búsqueda anterior (condición de carrera)', async () => {
    let resolverLenta
    const senales = []
    const p = usePeticion((cual, { signal }) => {
      senales.push(signal)
      return cual === 'lenta' ? new Promise((r) => (resolverLenta = r)) : Promise.resolve({ datos: ['nuevo'] })
    })
    const primera = p.ejecutar('lenta')
    await p.ejecutar('rapida')
    resolverLenta({ datos: ['viejo'] })
    await primera
    expect(senales[0].aborted).toBe(true)
    expect(p.datos.value).toEqual(['nuevo'])
  })

  it('pasa por los estados vacío y error, y cancela al desmontar', async () => {
    let senal
    const ambito = effectScope()
    const p = ambito.run(() => usePeticion(async (modo, { signal }) => {
      senal = signal
      if (modo === 'error') throw new Error('falló')
      if (modo === 'colgada') return new Promise(() => {})
      return { datos: [] }
    }))
    await p.ejecutar('vacio')
    expect(p.estado.value).toBe('vacio')
    await p.ejecutar('error')
    expect(p.estado.value).toBe('error')
    p.ejecutar('colgada')
    ambito.stop()
    expect(senal.aborted).toBe(true)
  })
})

describe('reglas de tareas', () => {
  const base = { titulo: 'Informe', descripcion: '', prioridad: 'alta', estado: 'pendiente', fechaLimite: null }

  it('valida título, prioridad y fechas imposibles', () => {
    expect(Object.keys(validarTarea({ ...base, titulo: 'ab', prioridad: 'urgente', fechaLimite: '2026-02-31' })))
      .toEqual(['titulo', 'prioridad', 'fechaLimite'])
    expect(validarTarea(base)).toEqual({})
  })

  it('no acepta meses pasados, salvo una fecha ya guardada que no se cambia', () => {
    expect(validarTarea({ ...base, fechaLimite: inicioMesActual() })).toEqual({})
    expect(validarTarea({ ...base, fechaLimite: '2020-01-15' }).fechaLimite).toMatch(/mes actual/)
    expect(validarTarea({ ...base, fechaLimite: '2020-01-15' }, '2020-01-15')).toEqual({})
  })

  it('diferencias devuelve solo lo modificado', () => {
    expect(diferencias({ ...base, fechaLimite: undefined }, { ...base, estado: 'completada' })).toEqual({ estado: 'completada' })
  })
})
