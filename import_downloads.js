import fs from 'fs';
import path from 'path';

const downloadsDir = path.join(process.env.HOME, 'Downloads');
const targetCto = './src/data/simulacrosCTO.json';
const targetTextos = './src/data/simulacros_textos.json';

// Helper to find the latest file matching a pattern
function getLatestFile(pattern) {
  try {
    const files = fs.readdirSync(downloadsDir)
      .filter(f => pattern.test(f))
      .map(f => {
        const filePath = path.join(downloadsDir, f);
        return {
          name: f,
          path: filePath,
          time: fs.statSync(filePath).mtimeMs
        };
      })
      .sort((a, b) => b.time - a.time);

    return files.length > 0 ? files[0] : null;
  } catch (e) {
    console.error("Error reading downloads directory:", e.message);
    return null;
  }
}

console.log("🔍 Buscando descargas de simulacros en:", downloadsDir);

const patternCto = /^simulacrosCTO(\s*\(\d+\))?\.json$/i;
const patternTextos = /^simulacros_textos(\s*\(\d+\))?\.json$/i;

const latestCto = getLatestFile(patternCto);
const latestTextos = getLatestFile(patternTextos);

// 1. IMPORTAR ESTADÍSTICAS (Sobrescribe completo, ya que cambian los percentiles)
if (latestCto) {
  console.log(`✅ Encontrado estadísticas: "${latestCto.name}" (Modificado: ${new Date(latestCto.time).toLocaleString()})`);
  fs.copyFileSync(latestCto.path, targetCto);
  console.log(`   -> Copiado a ${targetCto}`);
  
  try {
    const data = JSON.parse(fs.readFileSync(targetCto, 'utf8'));
    console.log(`   📊 Estadísticas cargadas: ${data.simulacros?.length || 0} simulacros, ${data.preguntas?.length || 0} preguntas.`);
  } catch (e) {
    console.warn("   ⚠️  No se pudo leer/analizar el archivo de estadísticas copiado.");
  }
} else {
  console.log("❌ No se encontró ningún archivo simulacrosCTO.json en Descargas.");
}

console.log("");

// 2. IMPORTAR TEXTOS (Fusión Inteligente)
if (latestTextos) {
  console.log(`✅ Encontrado textos: "${latestTextos.name}" (Modificado: ${new Date(latestTextos.time).toLocaleString()})`);
  
  try {
    const newData = JSON.parse(fs.readFileSync(latestTextos.path, 'utf8'));
    
    // Si ya existe un archivo de textos local, hacemos un merge
    let currentData = [];
    if (fs.existsSync(targetTextos)) {
      currentData = JSON.parse(fs.readFileSync(targetTextos, 'utf8'));
    }

    // Convertimos a un mapa para sobreescribir basándonos en simulacro + numero_pregunta
    const textMap = new Map();
    
    // Primero cargamos los existentes
    currentData.forEach(p => {
      if (p.simulacro && p.numero_pregunta) {
        textMap.set(`${p.simulacro}-${p.numero_pregunta}`, p);
      }
    });

    // Luego sobrescribimos con los nuevos descargados
    let newItemsCount = 0;
    newData.forEach(p => {
      if (p.simulacro && p.numero_pregunta) {
        if (!textMap.has(`${p.simulacro}-${p.numero_pregunta}`)) newItemsCount++;
        textMap.set(`${p.simulacro}-${p.numero_pregunta}`, p);
      }
    });

    const finalTexts = Array.from(textMap.values());
    
    fs.writeFileSync(targetTextos, JSON.stringify(finalTexts, null, 2));
    console.log(`   -> Fusionado y guardado en ${targetTextos}`);
    
    const uniqueSims = [...new Set(finalTexts.map(d => d.simulacro))].sort((a,b)=>a-b);
    console.log(`   📝 Total histórico textos: ${finalTexts.length} preguntas.`);
    console.log(`   🆕 Preguntas nuevas añadidas en este merge: ${newItemsCount}`);
    console.log(`   📚 Simulacros disponibles: [${uniqueSims.join(", ")}].`);
    
  } catch (e) {
    console.warn("   ⚠️  No se pudo leer/analizar o fusionar el archivo de textos copiado:", e.message);
  }
} else {
  console.log("❌ No se encontró ningún archivo simulacros_textos.json en Descargas.");
}
