#!/usr/bin/env python3
"""
scripts/verify_m1_adversarial.py
Adversarial Stress-Test Harness for Milestone 1:
2V Theme Matching, Data Pools Sanitization, and Filter Non-Regression.

Empirical verification script written by teamwork_preview_challenger.
"""

import json
import sys
import os
import unicodedata
import subprocess

def norm_text(s):
    if not s:
        return ''
    s = s.strip().lower()
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

MAPA_CANONICO_DESGLOSES = {
    'miscelanea': 'Bioética y Medicina Legal',
    'bioetica y medicina legal': 'Bioética y Medicina Legal',
    'bioetica': 'Bioética y Medicina Legal',
    'endocrinologia': 'Endocrinología y Metabolismo',
    'endocrinologia y metabolismo': 'Endocrinología y Metabolismo',
    'estadistica y epidemiologia': 'Estadística y Epidemiología',
    'epidemiologia': 'Estadística y Epidemiología',
    'medicina preventiva': 'Estadística y Epidemiología',
    'medicina preventiva y salud publica': 'Estadística y Epidemiología',
    'neurologia': 'Neurología y Neurocirugía',
    'neurologia y neurocirugia': 'Neurología y Neurocirugía',
    'oncologia medica y paciente terminal': 'Oncología',
    'paciente terminal y cuidados paliativos': 'Oncología',
    'enfermedades infecciosas': 'Infecciosas',
    'infecciosas': 'Infecciosas',
    'ginecologia y obstetricia': 'Ginecología y Obstetricia',
    'cirugia general': 'Cirugía General',
    'anatomia patologica': 'Anatomía Patológica',
    'medicina familiar y comunitaria': 'Medicina Familiar y Comunitaria',
    'medicina familiar': 'Medicina Familiar y Comunitaria'
}

def normalize_asig(asig):
    if not asig:
        return ''
    n = norm_text(asig)
    return MAPA_CANONICO_DESGLOSES.get(n, asig.strip())

def main():
    print("=" * 70)
    print("ADVERSARIAL STRESS-TEST: MILESTONE 1 VERIFICATION")
    print("=" * 70)

    # ---------------------------------------------------------
    # 1. Extract every single 2,097 Vuelta 2 question
    # ---------------------------------------------------------
    print("\n[Step 1] Extracting Vuelta 2 questions from src/data/bancoPreguntas.json...")
    with open('src/data/bancoPreguntas.json') as f:
        banco = json.load(f)
    
    v2_all = [q for q in banco if q.get('vuelta') == 2]
    print(f" -> Found {len(v2_all)} questions with vuelta === 2.")
    assert len(v2_all) == 2097, f"CRITICAL: Expected exactly 2097 V2 questions, got {len(v2_all)}"

    # Check structural integrity of all 2097 questions
    ids = set()
    for idx, q in enumerate(v2_all):
        qid = q.get('id')
        assert qid, f"Question at index {idx} missing id"
        assert qid not in ids, f"Duplicate id {qid} in V2 dataset"
        ids.add(qid)
        assert q.get('enunciado'), f"Question {qid} missing enunciado"
        ops = q.get('opciones')
        assert isinstance(ops, list), f"Question {qid} opciones is not a list"
        assert len(ops) == 4, f"Question {qid} does not have exactly 4 opciones (has {len(ops)})"
        assert q.get('correcta') in [1, 2, 3, 4], f"Question {qid} invalid correcta {q.get('correcta')}"
        assert q.get('asignatura'), f"Question {qid} missing asignatura"
        assert q.get('tema'), f"Question {qid} missing tema"

    print(" -> Structural integrity check passed for all 2,097 questions (4 options, valid correct answer, unique IDs).")

    # ---------------------------------------------------------
    # 2. Extract exact catalog of temasDisponibles from Desgloses.jsx
    # ---------------------------------------------------------
    print("\n[Step 2] Extracting exact catalog of temasDisponibles per subject as in Desgloses.jsx...")
    with open('src/data/desgloses_filtrables.json') as f:
        desgloses = json.load(f)

    # In Desgloses.jsx line 61:
    # const asignaturas = [...new Set(desglosesData.map(q => q.asignatura))].filter(Boolean).sort();
    asignaturas_catalog = sorted(list(set(q['asignatura'] for q in desgloses if q.get('asignatura'))))
    print(f" -> Catalog of active subjects in Desgloses.jsx: {len(asignaturas_catalog)} subjects.")

    # Replicate test2VPool mapping in Desgloses.jsx lines 139-164:
    test2v_pool = []
    for bq in banco:
        if bq.get('vuelta') == 2 and bq.get('enunciado') and isinstance(bq.get('opciones'), list) and len(bq.get('opciones')) == 4:
            asig = normalize_asig(bq.get('asignatura'))
            test2v_pool.append({
                'id': bq.get('id'),
                'enunciado': bq.get('enunciado'),
                'asignatura': asig,
                'tema': bq.get('tema') or 'General',
                'anualidad': 2026,
                'esTest2V': True
            })
    print(f" -> Normalized test2VPool count: {len(test2v_pool)}")
    assert len(test2v_pool) == 2097

    # temasDisponibles(subject) replicated from Desgloses.jsx lines 213-221:
    temas_disponibles_by_asig = {}
    for asig in asignaturas_catalog:
        temas_desg = [q['tema'] for q in desgloses if q.get('asignatura') == asig and q.get('tema')]
        temas_2v = [q['tema'] for q in test2v_pool if q.get('asignatura') == asig and q.get('tema')]
        temas_disponibles_by_asig[asig] = set(temas_desg) | set(temas_2v)

    total_distinct_temas = sum(len(t) for t in temas_disponibles_by_asig.values())
    print(f" -> Catalog contains {total_distinct_temas} subject-tema pairs across {len(asignaturas_catalog)} subjects.")

    # ---------------------------------------------------------
    # 3. Assert 100% of the 2,097 questions have a valid tema in catalog (0 failures)
    # ---------------------------------------------------------
    print("\n[Step 3] Asserting 100% of 2,097 questions match an active tema in temasDisponibles...")
    failures = []
    for q in v2_all:
        canon_asig = normalize_asig(q.get('asignatura'))
        if canon_asig not in temas_disponibles_by_asig:
            failures.append({
                'id': q.get('id'),
                'raw_asig': q.get('asignatura'),
                'canon_asig': canon_asig,
                'tema': q.get('tema'),
                'reason': f"Asignatura '{canon_asig}' not in Desgloses asignaturas catalog"
            })
            continue

        valid_temas = temas_disponibles_by_asig[canon_asig]
        if q.get('tema') not in valid_temas:
            failures.append({
                'id': q.get('id'),
                'raw_asig': q.get('asignatura'),
                'canon_asig': canon_asig,
                'tema': q.get('tema'),
                'reason': f"Tema '{q.get('tema')}' not in temasDisponibles for {canon_asig}"
            })

    print(f" -> Validation result: {len(failures)} failures out of 2,097 questions.")
    if failures:
        print("CRITICAL: Failed questions:")
        for f_item in failures[:10]:
            print(f"   - {f_item}")
    assert len(failures) == 0, f"CRITICAL: Found {len(failures)} questions failing catalog theme validation!"
    print(" -> PASS: Exactly 0 failures. 100.0% of Vuelta 2 questions exist in the active tema catalog.")

    # ---------------------------------------------------------
    # 4. Assert 0 questions have tema: "General" or empty/whitespace/null
    # ---------------------------------------------------------
    print("\n[Step 4] Asserting 0 questions have tema: 'General' or empty/whitespace/null...")
    general_or_blank = []
    for q in v2_all:
        tema = q.get('tema')
        if tema is None:
            general_or_blank.append((q.get('id'), 'None'))
        elif not isinstance(tema, str):
            general_or_blank.append((q.get('id'), f"Non-string: {type(tema)}"))
        elif not tema.strip():
            general_or_blank.append((q.get('id'), 'Whitespace/Empty'))
        elif tema.strip().lower() in ['general', 'null', 'undefined', 'n/a', 'sin tema']:
            general_or_blank.append((q.get('id'), tema))

    print(f" -> Found {len(general_or_blank)} questions with General/empty/whitespace/null tema.")
    assert len(general_or_blank) == 0, f"CRITICAL: Found {len(general_or_blank)} questions with invalid tema: {general_or_blank}"
    print(" -> PASS: Exactly 0 questions have 'General' or empty/whitespace/null tema.")

    # ---------------------------------------------------------
    # 5. Challenge edge cases: 7 subjects with 92 uncataloged questions
    # ---------------------------------------------------------
    print("\n[Step 5] Adversarial stress-testing of 7 edge-case subjects (92 uncataloged questions)...")
    edge_cases = {
        'Radiología': {
            'expected_uncataloged_count': 52,
            'expected_uncataloged_themes': {'Musculoesquelético', 'Pediatría', 'Neurorradiología', 'Ginecología', 'Tórax'},
            'canonical_asig': 'Radiología'
        },
        'Medicina Familiar y Comunitaria': {
            'expected_uncataloged_count': 21,
            'expected_uncataloged_themes': {
                'Actividades preventivas y de promoción de la salud, programas de salud y educación sanitaria',
                'Gestión en Atención Primaria',
                'Síndrome de Burnout',
                'Prevención y atención al maltrato',
                'Vacunación en la población adulta',
                'Comunicación médico-paciente. Entrevista clínica',
                'Demografía sanitaria',
                'Uso racional del medicamento, prescripción y sistemas de farmacovigilancia y seguridad',
                'Continuidad de asistencia y de cuidados. El paciente hiperconsumidor de recursos y estrategia de atención al paciente crónico',
                'Atención al embarazo en Atención Primaria',
                'Prevención y tratamiento de ETS'
            },
            'canonical_asig': 'Medicina Familiar y Comunitaria'
        },
        'Oftalmología': {
            'expected_uncataloged_count': 9,
            'expected_uncataloged_themes': {'Órbita', 'Estrabismo'},
            'canonical_asig': 'Oftalmología'
        },
        'Anestesiología': {
            'expected_uncataloged_count': 5,
            'expected_uncataloged_themes': {'Manejo de la vía aérea'},
            'canonical_asig': 'Anestesiología'
        },
        'Dermatología': {
            'expected_uncataloged_count': 3,
            'expected_uncataloged_themes': {'Manifestaciones cutáneas de otras enfermedades sistémicas'},
            'canonical_asig': 'Dermatología'
        },
        'Neurología y Neurocirugía': {
            'expected_uncataloged_count': 1,
            'expected_uncataloged_themes': {'Anomalías del desarrollo'},
            'canonical_asig': 'Neurología y Neurocirugía'
        },
        'Pediatría': {
            'expected_uncataloged_count': 1,
            'expected_uncataloged_themes': {'Calendario quirúrgico pediátrico'},
            'canonical_asig': 'Pediatría'
        }
    }

    total_edge_tested = 0
    for subj_key, meta in edge_cases.items():
        canon = meta['canonical_asig']
        v2_subj = [q for q in v2_all if normalize_asig(q.get('asignatura')) == canon]
        desg_subj_temas = set(q['tema'] for q in desgloses if q.get('asignatura') == canon and q.get('tema'))
        uncataloged_in_desg = [q for q in v2_subj if q.get('tema') not in desg_subj_temas]
        uncataloged_themes = set(q.get('tema') for q in uncataloged_in_desg)

        print(f" -> Subject: {subj_key} ({canon})")
        print(f"    - Total 2V questions: {len(v2_subj)}")
        print(f"    - Questions in themes not in desglosesData: {len(uncataloged_in_desg)} (expected: {meta['expected_uncataloged_count']})")
        assert len(uncataloged_in_desg) == meta['expected_uncataloged_count'], (
            f"Edge case mismatch for {subj_key}: expected {meta['expected_uncataloged_count']}, got {len(uncataloged_in_desg)}"
        )
        assert uncataloged_themes == meta['expected_uncataloged_themes'], (
            f"Theme mismatch for {subj_key}: expected {meta['expected_uncataloged_themes']}, got {uncataloged_themes}"
        )

        # Confirm all these themes ARE in temasDisponibles:
        for t in uncataloged_themes:
            assert t in temas_disponibles_by_asig[canon], f"Tema '{t}' missing from temasDisponibles for {canon}!"

        total_edge_tested += len(uncataloged_in_desg)

    assert total_edge_tested == 92, f"Expected 92 edge case questions tested, got {total_edge_tested}"
    print(f" -> PASS: All 7 edge-case subjects and exactly 92 previously uncataloged questions verified.")

    # ---------------------------------------------------------
    # 6. Verify no regressions on filtering by tema in Desgloses
    # ---------------------------------------------------------
    print("\n[Step 6] Simulating Desgloses.jsx filtering logic across test2VPool and desglosesData...")
    # Replicate aplicarFiltrosCon logic (Desgloses.jsx lines 701-729)
    def simular_filtro(asignatura, temas=None, min_year=2015, solo_no_hechas=True, hechas_set=None):
        if hechas_set is None:
            hechas_set = set()
        
        # Desgloses questions
        desg_pool = [
            {
                'id': q['id'],
                'asignatura': q['asignatura'],
                'tema': q['tema'],
                'dificultad': q.get('dificultad', 3),
                'anualidad': q.get('anualidad', 2020),
                'esTest2V': False
            }
            for q in desgloses
        ]
        
        # Combined basePool
        base_pool = desg_pool + test2v_pool
        nucleo = list(base_pool)

        if asignatura:
            nucleo = [q for q in nucleo if q['asignatura'] == asignatura]
        if temas and len(temas) > 0:
            nucleo = [q for q in nucleo if q['tema'] in temas]
        if min_year:
            nucleo = [q for q in nucleo if q['anualidad'] >= min_year]
        if solo_no_hechas:
            nucleo = [q for q in nucleo if q['id'] not in hechas_set]

        return nucleo

    # Scenario A: Filter Radiología by 'Tórax'
    rad_torax = simular_filtro('Radiología', ['Tórax'])
    v2_rad_torax = [q for q in rad_torax if q['esTest2V']]
    print(f" -> Scenario A (Radiología + 'Tórax'): {len(rad_torax)} total, {len(v2_rad_torax)} from 2V.")
    assert len(v2_rad_torax) > 0, "No 2V questions found when filtering Radiología by Tórax"
    assert all(q['tema'] == 'Tórax' for q in rad_torax)

    # Scenario B: Filter Radiología by multiple themes ['Tórax', 'Neurorradiología']
    rad_multi = simular_filtro('Radiología', ['Tórax', 'Neurorradiología'])
    assert all(q['tema'] in ['Tórax', 'Neurorradiología'] for q in rad_multi)
    assert any(q['tema'] == 'Tórax' for q in rad_multi)
    assert any(q['tema'] == 'Neurorradiología' for q in rad_multi)
    print(f" -> Scenario B (Radiología multi-theme): {len(rad_multi)} questions returned correctly.")

    # Scenario C: Filter Oftalmología by 'Estrabismo' and 'Órbita'
    oft_estrab = simular_filtro('Oftalmología', ['Estrabismo'])
    assert len(oft_estrab) == 6, f"Expected 6 Estrabismo questions, got {len(oft_estrab)}"
    assert all(q['esTest2V'] for q in oft_estrab), "All Estrabismo questions should come from 2V"
    print(f" -> Scenario C1 (Oftalmología + 'Estrabismo'): {len(oft_estrab)} questions returned correctly.")

    oft_orbita = simular_filtro('Oftalmología', ['Órbita'])
    assert len(oft_orbita) == 3, f"Expected 3 Órbita questions, got {len(oft_orbita)}"
    assert all(q['esTest2V'] for q in oft_orbita), "All Órbita questions should come from 2V"
    print(f" -> Scenario C2 (Oftalmología + 'Órbita'): {len(oft_orbita)} questions returned correctly.")

    # Scenario D: Filter MFyC by 'Síndrome de Burnout'
    mfyc_burnout = simular_filtro('Medicina Familiar y Comunitaria', ['Síndrome de Burnout'])
    assert len(mfyc_burnout) == 1, f"Expected 1 Burnout question, got {len(mfyc_burnout)}"
    print(f" -> Scenario D (MFyC + 'Síndrome de Burnout'): {len(mfyc_burnout)} question returned correctly.")

    # Scenario E: Filter Anestesiología by 'Manejo de la vía aérea'
    anest_via = simular_filtro('Anestesiología', ['Manejo de la vía aérea'])
    assert len(anest_via) == 5, f"Expected 5 Manejo de la vía aérea questions, got {len(anest_via)}"
    print(f" -> Scenario E (Anestesiología + 'Manejo de la vía aérea'): {len(anest_via)} questions returned correctly.")

    # Scenario F: Filter Dermatología by 'Manifestaciones cutáneas de otras enfermedades sistémicas'
    derm_sist = simular_filtro('Dermatología', ['Manifestaciones cutáneas de otras enfermedades sistémicas'])
    assert len(derm_sist) == 3, f"Expected 3 Manifestaciones cutáneas questions, got {len(derm_sist)}"
    print(f" -> Scenario F (Dermatología + 'Manifestaciones cutáneas...'): {len(derm_sist)} questions returned correctly.")

    # Scenario G: Filter Neurología by 'Anomalías del desarrollo'
    neuro_anom = simular_filtro('Neurología y Neurocirugía', ['Anomalías del desarrollo'])
    assert len(neuro_anom) == 1, f"Expected 1 Anomalías del desarrollo question, got {len(neuro_anom)}"
    print(f" -> Scenario G (Neurología + 'Anomalías del desarrollo'): {len(neuro_anom)} question returned correctly.")

    # Scenario H: Filter Pediatría by 'Calendario quirúrgico pediátrico'
    ped_quir = simular_filtro('Pediatría', ['Calendario quirúrgico pediátrico'])
    assert len(ped_quir) == 1, f"Expected 1 Calendario quirúrgico question, got {len(ped_quir)}"
    print(f" -> Scenario H (Pediatría + 'Calendario quirúrgico pediátrico'): {len(ped_quir)} question returned correctly.")

    # Scenario I: Filter by subject only (no themes)
    card_all = simular_filtro('Cardiología')
    desg_card_count = len([q for q in desgloses if q.get('asignatura') == 'Cardiología' and (q.get('anualidad') or 0) >= 2015])
    v2_card_count = len([q for q in test2v_pool if q['asignatura'] == 'Cardiología'])
    assert len(card_all) == desg_card_count + v2_card_count
    print(f" -> Scenario I (Subject sweep without themes): {len(card_all)} questions = {desg_card_count} desg + {v2_card_count} 2V.")

    # Scenario J: Filter by nonexistent theme
    empty_result = simular_filtro('Cardiología', ['Tema Inexistente XYZ'])
    assert len(empty_result) == 0
    print(" -> Scenario J (Nonexistent theme): safely returns empty list without error.")

    # ---------------------------------------------------------
    # 7. Check Data Sanitization Across Other Pools
    # ---------------------------------------------------------
    print("\n[Step 7] Checking data sanitization across desgloses, evaluaciones, and prioridadesTemas...")
    
    # Check prioridadesTemas alias
    with open('src/lib/prioridadesTemas.js') as f:
        pt_content = f.read()
    assert "'medicina preventiva y salud publica': 'Estadística y Epidemiología'" in pt_content

    # Check 0 null temas in desgloses_filtrables
    null_desg = [q for q in desgloses if not q.get('tema') or not str(q.get('tema')).strip()]
    assert len(null_desg) == 0, f"Found {len(null_desg)} null temas in desgloses"

    # Check 0 General in evaluaciones_cto
    with open('src/data/evaluaciones_cto.json') as f:
        evals = json.load(f)
    gen_evals = [q for q in evals if str(q.get('tema', '')).strip().lower() == 'general']
    assert len(gen_evals) == 0, f"Found {len(gen_evals)} General temas in evaluaciones_cto"

    print(" -> PASS: All data sanitizations confirmed.")

    # ---------------------------------------------------------
    # 8. Check Build and Test Commands
    # ---------------------------------------------------------
    print("\n[Step 8] Checking build and master test suite...")
    build_res = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True)
    assert build_res.returncode == 0, f"npm run build failed:\n{build_res.stderr}"
    print(" -> PASS: npm run build completed with exit code 0.")

    test_res = subprocess.run(['bash', 'tests/run_all_tests.sh'], capture_output=True, text=True)
    assert test_res.returncode == 0, f"run_all_tests.sh failed:\n{test_res.stderr}"
    print(" -> PASS: bash tests/run_all_tests.sh passed 100% of test suites.")

    print("\n" + "=" * 70)
    print("ADVERSARIAL STRESS-TEST VERDICT: APPROVE (ZERO DEFECTS)")
    print("=" * 70)

if __name__ == '__main__':
    main()
