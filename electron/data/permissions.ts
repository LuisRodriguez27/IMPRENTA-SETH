// Catálogo de permisos del sistema.
//
// Fuente única: la usan tanto la migración `seed_permisos` (que los inserta en
// la BD del cliente al arrancar) como el script de desarrollo seed.ts.
// Si agregas un permiso aquí, las BD que ya existen NO lo reciben solas:
// hace falta una migración nueva que lo inserte.

export interface AppPermission {
  name: string;
  description: string;
}

export const APP_PERMISSIONS: AppPermission[] = [
  // Usuarios y permisos
  { name: 'Gestionar Usuario', description: 'Permite crear, editar o desactivar usuarios' },
  { name: 'Gestionar Permisos', description: 'Permite asignar o revocar permisos a los usuarios' },

  // Clientes
  { name: 'Crear Cliente', description: 'Permite registrar nuevos clientes' },
  { name: 'Editar Cliente', description: 'Permite modificar datos de clientes' },
  { name: 'Eliminar Cliente', description: 'Permite eliminar o desactivar clientes' },

  // Productos
  { name: 'Crear Familia', description: 'Permite registrar nuevas familias de productos' },
  { name: 'Editar Familia', description: 'Permite modificar información de familias de productos' },
  { name: 'Eliminar Familia', description: 'Permite eliminar o desactivar familias de productos' },

  // Plantillas de productos
  { name: 'Crear Producto', description: 'Permite crear productos' },
  { name: 'Editar Producto', description: 'Permite modificar productos' },
  { name: 'Eliminar Producto', description: 'Permite eliminar productos' },

  // Órdenes
  { name: 'Crear Órdenes', description: 'Permite registrar nuevas órdenes' },
  { name: 'Editar Órdenes', description: 'Permite modificar órdenes' },
  { name: 'Cancelar Órdenes', description: 'Permite cancelar órdenes' },

  // Presupuestos
  { name: 'Crear Presupuestos', description: 'Permite registrar nuevos presupuestos' },
  { name: 'Eliminar Presupuestos', description: 'Permite eliminar presupuestos' },
  { name: 'Editar Presupuestos', description: 'Permite editar los presupuestos registrados' },

  // Pagos
  { name: 'Ver Pagos', description: 'Permite ver los pagos registrados' },
  { name: 'Registrar Pagos', description: 'Permite registrar pagos en órdenes' },
  { name: 'Eliminar Pagos', description: 'Permite eliminar o anular pagos' },

  // Estadísticas
  { name: 'Estadisticas', description: 'Permite visualizar las estadisticas de ventas' },
  { name: 'Estadisticas: Filtros', description: 'Permite aplicar filtros para visualizar las estadisticas' },
  { name: 'Estadisticas: Hoy', description: 'Permite visualizar la grafica de el dia de hoy' },

  // Caja
  { name: 'Abrir Caja', description: 'Abre una caja' },
  { name: 'Cerrar Caja', description: 'Cierra una caja' },
  { name: 'Ver Caja', description: 'Puede ver los movimientos de la caja' },
  { name: 'Registrar Egreso', description: 'Puede registrar egresos' },
  { name: 'Reabrir Caja', description: 'Permite volver a abrir una sesión de caja cerrada' },

  // Proveedores / Mayoristas
  { name: 'Ver Mayoristas', description: 'Permite ver el módulo de mayoristas/proveedores' },
  { name: 'Crear Orden Mayorista', description: 'Permite crear una orden para un mayorista' },

  // Bitácora de impresión
  { name: 'Ver Bitacora de Impresion', description: 'Permite ver la bitácora de impresión' },
  { name: 'Gestionar Bitacora de Impresion', description: 'Permite crear, editar y eliminar registros de la bitácora de impresión' },
];
