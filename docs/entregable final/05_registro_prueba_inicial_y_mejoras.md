# 05. Registro de la Primera Prueba del Juego: Incidencias y Mejoras

- **Proyecto:** Frank and Bang (*Proyecto final — FrankenTillería*)
- **Fecha de la prueba:** 2026-11-24
- **Responsable del registro:** Daniel Martinez
- **Alcance:** registro de cuentas, acceso y experiencia de juego durante la primera ronda de pruebas

---

## 1. Objetivo de la prueba

La primera prueba del juego buscó validar el registro de nuevos jugadores, el
acceso a una sala y el desarrollo de una partida con varias personas. Como
resultado de las rondas jugadas se documentaron dos incidencias de acceso y
diversas mejoras implementadas posteriormente.

---

## 2. Problemas detectados

| # | Incidencia | Impacto en el jugador | Detalle observado | Estado |
|---|---|---|---|---|
| 1 | Longitud excedida en la dirección de Gmail durante el registro | Algunos jugadores no pudieron crear una cuenta y, por lo tanto, no pudieron entrar a jugar | El correo de Gmail era demasiado largo y superaba el número de caracteres permitido, por lo que el formulario de registro rechazaba la cuenta | Corregido |
| 2 | Redirección a una página de error tras la confirmación del correo | El jugador encontraba una página de error sin información y no comprendía qué había ocurrido | Después de hacer clic en el enlace del correo de confirmación, la navegación terminaba en una página de error, aunque la cuenta quedaba efectivamente confirmada | Corregido |

El estado **Corregido** refleja la información reportada por el equipo tras la
primera ronda. El detalle técnico de cada solución no fue documentado en este
registro, por lo que no se especula sobre los cambios de implementación.

---

## 3. Mejoras implementadas tras la primera ronda

| # | Mejora | Motivo | Resultado |
|---|---|---|---|
| 1 | Salto del personaje | Si la criatura quedaba atascada dentro de un cráter o hoyo, no podía continuar la partida | El comando de salto permite salir del hoyo y reanudar el turno con normalidad |
| 2 | Zoom con la rueda del ratón | El mapa es amplio y resultaba difícil ubicar a los demás jugadores durante el combate | El jugador puede acercar y alejar la vista del mapa desplazando la rueda del ratón |

---

## 4. Adiciones finales de presentación

- **Animación de apertura de sobres del Gacha:** se incorporó una secuencia de
  apertura animada para las bolsas de cartas, haciendo más visible y atractivo
  el resultado de cada sobre.
- **Renovación visual y animaciones del menú principal:** se mejoró la apariencia
  general del menú y se añadieron animaciones para darle mayor fluidez y una
  presentación más acorde con la estética del juego.

---

## 5. Conclusiones y acciones pendientes

- Las dos incidencias de registro detectadas en la primera prueba ya fueron
  corregidas, de modo que el acceso al juego quedó desbloqueado para los
  jugadores afectados.
- El salto y el zoom con la rueda del ratón responden directamente a problemas
  de jugabilidad observados en las primeras partidas.
- Las animaciones de los sobres y del menú completan la experiencia visual sin
  alterar la mecánica de combate.
- Este documento queda como línea base de la primera prueba; cualquier nueva
  incidencia o mejora debe registrarse en una sesión posterior.
