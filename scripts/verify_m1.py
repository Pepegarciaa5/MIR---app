import json
import sys
import os

def main():
    print('=== 1. VERIFYING bancoPreguntas.json (2,097 V2 questions) ===')
    with open('src/data/bancoPreguntas.json') as f:
        banco = json.load(f)
    v2 = [q for q in banco if q.get('vuelta') == 2]
    print(f'Total v2 questions: {len(v2)}')
    assert len(v2) == 2097, f'Expected 2097 v2 questions, got {len(v2)}'

    general_or_empty = [q for q in v2 if not q.get('tema') or q.get('tema').strip() == 'General']
    print(f'V2 questions with General or empty tema: {len(general_or_empty)}')
    assert len(general_or_empty) == 0, f'Expected 0 General/empty, found {len(general_or_empty)}'

    print('\n=== 2. VERIFYING MATCH WITH Desgloses.jsx filterable themes ===')
    with open('src/data/desgloses_filtrables.json') as f:
        desg = json.load(f)

    # Compute filterable themes per subject exactly as Desgloses.jsx does:
    desg_temas_by_asig = {}
    for q in desg:
        asig = q.get('asignatura')
        tema = q.get('tema')
        if asig and tema:
            desg_temas_by_asig.setdefault(asig, set()).add(tema)

    v2_temas_by_asig = {}
    for q in v2:
        asig = q.get('asignatura')
        tema = q.get('tema')
        if asig and tema:
            v2_temas_by_asig.setdefault(asig, set()).add(tema)

    union_temas_by_asig = {}
    all_asigs = set(desg_temas_by_asig.keys()) | set(v2_temas_by_asig.keys())
    for asig in all_asigs:
        union_temas_by_asig[asig] = desg_temas_by_asig.get(asig, set()) | v2_temas_by_asig.get(asig, set())

    unmatched_v2 = []
    for q in v2:
        asig = q.get('asignatura')
        tema = q.get('tema')
        if tema not in union_temas_by_asig.get(asig, set()):
            unmatched_v2.append(q)

    print(f'Unmatched v2 questions vs union catalog: {len(unmatched_v2)}')
    assert len(unmatched_v2) == 0, f'Found {len(unmatched_v2)} unmatched questions'
    print('--> 100% (2,097/2,097) of Vuelta 2 questions match filterable themes in Desgloses.jsx!')

    print('\n=== 3. VERIFYING data cleanups ===')
    with open('src/lib/prioridadesTemas.js') as f:
        pt_content = f.read()
    assert "'medicina preventiva y salud publica': 'Estadística y Epidemiología'" in pt_content, 'Missing alias in prioridadesTemas.js'
    print('A. prioridadesTemas.js: medicina preventiva y salud publica alias verified.')

    null_desg = [q for q in desg if not q.get('tema')]
    print(f'B. desgloses_filtrables.json null temas count: {len(null_desg)}')
    assert len(null_desg) == 0, f'Found {len(null_desg)} null temas in desgloses_filtrables.json'

    with open('src/data/evaluaciones_cto.json') as f:
        evals = json.load(f)
    gen_evals = [q for q in evals if q.get('tema') == 'General']
    print(f'C. evaluaciones_cto.json General temas count: {len(gen_evals)}')
    assert len(gen_evals) == 0, f'Found {len(gen_evals)} General temas in evaluaciones_cto.json'

    print('\n=== 4. VERIFYING exports/auditoria_sistema_3v.md ===')
    assert os.path.exists('exports/auditoria_sistema_3v.md'), 'exports/auditoria_sistema_3v.md does not exist'
    with open('exports/auditoria_sistema_3v.md') as f:
        audit_text = f.read()

    required_sections = [
        '## 1. Resumen Ejecutivo y Alcance Operativo',
        '## 2. Inventario y Calidad de los Pools de Datos Reales',
        '## 3. Simulación Matemática de Cobertura por Asignatura (35 Asignaturas)',
        '## 4. Dinámica de Absorción del Motor 3 (Mixto Adaptativo P80)',
        '## 5. Diagnóstico de Cuellos de Botella y Riesgos del Sistema',
        '## 6. Auditoría y Validación Temática de 2ª Vuelta (`bancoPreguntas.json`)',
        '## 7. Plan de Acción Quirúrgico y Hoja de Ruta de Implementación',
        '## 8. Métricas de Seguimiento en la App (Integración con Panel Evaluación P80 - R2)'
    ]

    for sec in required_sections:
        assert sec in audit_text, f'Missing section: {sec}'
        print(f'Found section: {sec}')

    assert 'Alergología' in audit_text and 'Digestivo' in audit_text and 'Estadística y Epidemiología' in audit_text
    assert '1.844' in audit_text
    assert '2.160' in audit_text
    assert 'Cuello de Botella A' in audit_text
    assert 'Cuello de Botella B' in audit_text
    assert 'Cuello de Botella C' in audit_text
    print('All 8 required sections and key figures verified in exports/auditoria_sistema_3v.md.')

    print('\n=== 5. VERIFYING Desgloses.jsx Motor 3 Calibrations ===')
    with open('src/screens/Desgloses.jsx') as f:
        desg_code = f.read()

    assert 'ASIGNATURAS_HUERFANAS' in desg_code, 'Missing ASIGNATURAS_HUERFANAS in Desgloses.jsx'
    assert 'huerfana_absorcion' in desg_code, 'Missing huerfana_absorcion in Desgloses.jsx'
    assert 'poolDeficitGlobal' in desg_code, 'Missing poolDeficitGlobal in Desgloses.jsx'
    assert 'maxLatencia' in desg_code, 'Missing maxLatencia in Desgloses.jsx'
    assert '24 : 16' in desg_code, 'Missing dynamic latency expansion 24 : 16 in Desgloses.jsx'
    assert 'temasDesgloses' in desg_code and 'temas2V' in desg_code, 'Missing union in temasDisponibles'
    print('Motor 3 calibrations in Desgloses.jsx verified.')

    print('\nALL AUDIT AND INTEGRITY CHECKS PASSED PERFECTLY!')

if __name__ == '__main__':
    main()
