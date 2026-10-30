const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PUERTO = 3000;
const URL_MONGO = 'mongodb://localhost:27017';

const cliente = new MongoClient(URL_MONGO);
let coleccion;

// Interpreta los datos que envía el formulario (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function pagina(titulo, mensaje, color) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title></head>
<body style="font-family: Arial, sans-serif; max-width: 480px; margin: 30px auto;">
  <h1 style="color:${color}">${titulo}</h1>
  <p>${mensaje}</p>
  <p><a href="/">Volver al formulario</a></p>
</body></html>`;
}

// Convierte el texto recibido en número; devuelve NaN si está vacío o no es numérico
function aNumero(valor) {
  if (valor === undefined || String(valor).trim() === '') return NaN;
  return Number(valor);
}

// GET /: muestra el formulario
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// POST /guardar: valida, recalcula y guarda
app.post('/guardar', async (req, res) => {
  const identificacion = (req.body.identificacion || '').trim();
  const nombre = (req.body.nombre || '').trim();
  const materia = (req.body.materia || '').trim();
  const nota1 = aNumero(req.body.nota1);
  const nota2 = aNumero(req.body.nota2);
  const nota3 = aNumero(req.body.nota3);

  // 1. Campos obligatorios
  if (!identificacion || !nombre || !materia) {
    return res.status(400).send(pagina('Error', 'Todos los campos son obligatorios.', '#b00020'));
  }

  // 2. Formato de la identificación (mismo que en el HTML)
  if (!/^[0-9]{5,12}$/.test(identificacion)) {
    return res.status(400).send(pagina('Error', 'La identificación debe tener solo números, entre 5 y 12 dígitos.', '#b00020'));
  }

  // 3. Notas numéricas y dentro del rango 0.0 a 5.0
  const notas = [nota1, nota2, nota3];
  if (notas.some(n => Number.isNaN(n) || n < 0 || n > 5)) {
    return res.status(400).send(pagina('Error', 'Las tres notas deben ser números entre 0.0 y 5.0.', '#b00020'));
  }

  // 4. La definitiva se recalcula en el servidor (no se usa la que envió el navegador)
  const definitiva = Number(((nota1 + nota2 + nota3) / 3).toFixed(2));

  try {
    await coleccion.insertOne({ identificacion, nombre, materia, nota1, nota2, nota3, definitiva });
    res.send(pagina('Registro guardado',
      `Se guardó a ${escapar(nombre)} en ${escapar(materia)} con definitiva ${definitiva.toFixed(2)}.`, '#2e7d32'));
  } catch (err) {
    console.error(err);
    res.status(500).send(pagina('Error', 'No se pudo guardar el registro en la base de datos.', '#b00020'));
  }
});

// Conecta a MongoDB y luego arranca el servidor
async function iniciar() {
  await cliente.connect();
  coleccion = cliente.db('bdacademica').collection('notas');
  console.log('Conectado a MongoDB: bdacademica.notas');
  app.listen(PUERTO, () => console.log(`Servidor en http://localhost:${PUERTO}`));
}

iniciar().catch(err => {
  console.error('No se pudo conectar a MongoDB:', err);
  process.exit(1);
});