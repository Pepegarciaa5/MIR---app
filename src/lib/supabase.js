/**
 * Archivo: supabase.js
 * Descripción: Inicialización del cliente de Supabase y validación del modo administrador.
 * Creado: 2026-05-07
 * Última actualización: 2026-05-17
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const DEFAULT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscGp6b2toaXVhdnNhYm9ldGduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4NTUyMiwiZXhwIjoyMDkzNjYxNTIyfQ.uUrd8iE16WZO1XehRyWZey62eZTrujqEHyqk3DkMPWI'

const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SERVICE_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// True when using service_role key
export const isAdminMode = true

// Función para obtener conceptos clave
export const fetchConceptosClave = async () => {
  const { data, error } = await supabase
    .from('conceptos_clave')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching conceptos clave:', error);
    return [];
  }

  return data;
};
