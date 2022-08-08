# Lista de tareas pendientes

## Revisión completa del chequeo de duplicados de pedido
Esto implica dar coherencia a la hora de hacer las búsquedas de todos los nodos con CRC, la antiguedad de los nodos, y la semántica de los mismos.
A su vez, esto podría afectar a la consulta de nodos por CRC y a la retransmisión de nodos.

## Funciones en la base de datos
Hay ciertas funciones, como la de conver de almacén, que podrían moverse a la configuración de la base de datos.
De este modo, se podrían cambiar las lógicas sin tener que reiniciar los concentradores.

## Asegurar que las confirmaciones de pedido de SAP actualizan el estado en el WebSocket