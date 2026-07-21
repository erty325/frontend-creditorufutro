# Sistema de Score Crediticio - CreditoFuturo

## Documentación Técnica para Backend

**Versión:** 2.0  
**Fecha:** Enero 2026  
**Autor:** Sistema de Análisis de Riesgo

---

## 1. Resumen Ejecutivo

Este documento describe la arquitectura del modelo de score crediticio que evalúa la **Probabilidad de Default (PD)** basándose en cuatro dimensiones críticas de comportamiento de pago.

### Escala de Score
- **Rango:** 0 a 1,000 puntos
- **Inicio:** Todos los usuarios comienzan en 0 puntos
- **Dirección:** Mayor puntaje = Menor riesgo

---

## 2. Variables de Entrada (Features)

### Variable A: Pagos Post-Plazo Inicial (20% del peso)
**Descripción:** Analiza la frecuencia y severidad de los pagos realizados después de que el contrato original ha expirado.

```python
# Pseudocódigo Python
def calcular_variable_a(usuario):
    """
    Calcula la tasa de recuperación tardía.
    
    Parámetros evaluados:
    - pagos_post_vencimiento: Número de pagos realizados después del plazo
    - total_cuotas: Total de cuotas del préstamo
    
    Returns:
        score_a: Float entre 0 y 200 (20% de 1000)
    """
    cuotas = usuario.get('cuotas', [])
    fecha_fin_contrato = calcular_fecha_fin_contrato(usuario)
    hoy = datetime.now()
    
    # Calcular pagos realizados después del plazo
    pagos_post_plazo = 0
    total_pagados = 0
    
    for cuota in cuotas:
        if cuota['pagado']:
            total_pagados += 1
            fecha_pago = datetime.fromisoformat(cuota.get('fechaPago', cuota['fecha']))
            if fecha_pago > fecha_fin_contrato:
                pagos_post_plazo += 1
    
    # Calcular tasa de recuperación tardía
    if total_pagados > 0:
        tasa_recuperacion_tardia = pagos_post_plazo / total_pagados
    else:
        tasa_recuperacion_tardia = 0
    
    # Calcular score (inverso: menos pagos post-plazo = mejor score)
    if tasa_recuperacion_tardia == 0:
        score_a = 200  # Máximo: sin pagos tardíos
    elif tasa_recuperacion_tardia <= 0.1:
        score_a = 180
    elif tasa_recuperacion_tardia <= 0.25:
        score_a = 140
    elif tasa_recuperacion_tardia <= 0.5:
        score_a = 100
    elif tasa_recuperacion_tardia <= 0.75:
        score_a = 50
    else:
        score_a = 0  # Todos los pagos fueron post-plazo
    
    return score_a
```

**Tabla de Interpretación Variable A:**

| Tasa Recuperación Tardía | Score | Interpretación |
|--------------------------|-------|----------------|
| 0% | 200 | Excelente: Sin pagos post-plazo |
| 1-10% | 180 | Muy Bueno: Pagos ocasionales post-plazo |
| 11-25% | 140 | Bueno: Algunos pagos post-plazo |
| 26-50% | 100 | Regular: Pagos frecuentes post-plazo |
| 51-75% | 50 | Deficiente: Mayoría post-plazo |
| 76-100% | 0 | Crítico: Todos post-plazo |

---

### Variable B: Sensibilidad Quincenal (25% del peso)
**Descripción:** Mide la correlación entre la fecha de pago y el ciclo de nómina (días 15 y 30).

```python
def calcular_variable_b(usuario):
    """
    Define un indicador de riesgo para pagos que ocurren sistemáticamente 
    entre 1 y 5 días después de la quincena (indicando falta de ahorro 
    o flujo de caja ajustado).
    
    Días de nómina típicos: 15 y 30/31 de cada mes
    Ventana de riesgo: días 16-20 y 1-5 del mes siguiente
    
    Returns:
        score_b: Float entre 0 y 250 (25% de 1000)
    """
    cuotas = usuario.get('cuotas', [])
    pagos_en_ventana_riesgo = 0
    total_pagos = 0
    
    for cuota in cuotas:
        if cuota['pagado'] and cuota.get('fechaPago'):
            total_pagos += 1
            fecha_pago = datetime.fromisoformat(cuota['fechaPago'])
            dia_pago = fecha_pago.day
            
            # Ventanas de riesgo post-quincena
            # Días 16-20 (después del 15)
            # Días 1-5 (después del 30/31)
            if (16 <= dia_pago <= 20) or (1 <= dia_pago <= 5):
                pagos_en_ventana_riesgo += 1
    
    if total_pagos == 0:
        # Sin historial, score neutral
        return 125
    
    # Calcular porcentaje de pagos en ventana de riesgo
    porcentaje_riesgo = pagos_en_ventana_riesgo / total_pagos
    
    # Calcular score (inverso: menos pagos en ventana = mejor score)
    if porcentaje_riesgo == 0:
        score_b = 250  # Máximo: nunca paga en ventana de riesgo
    elif porcentaje_riesgo <= 0.1:
        score_b = 225
    elif porcentaje_riesgo <= 0.25:
        score_b = 187
    elif porcentaje_riesgo <= 0.5:
        score_b = 125
    elif porcentaje_riesgo <= 0.75:
        score_b = 62
    else:
        score_b = 0  # Siempre paga en ventana de riesgo
    
    return score_b
```

**Tabla de Interpretación Variable B:**

| % Pagos Post-Quincena | Score | Interpretación |
|-----------------------|-------|----------------|
| 0% | 250 | Excelente: Flujo de caja sólido |
| 1-10% | 225 | Muy Bueno: Ocasionalmente ajustado |
| 11-25% | 187 | Bueno: Flujo moderadamente ajustado |
| 26-50% | 125 | Regular: Depende de la nómina |
| 51-75% | 62 | Deficiente: Alta dependencia de nómina |
| 76-100% | 0 | Crítico: Sin capacidad de ahorro |

---

### Variable C: Comportamiento Capital vs. Interés (40% del peso)
**Descripción:** Evalúa la estructura del pago, diferenciando entre clientes que solo cubren el pago mínimo (intereses/comisiones) versus aquellos que realizan abonos constantes al capital.

```python
def calcular_variable_c(usuario):
    """
    Asigna mayor puntaje a la reducción real del saldo insoluto.
    Identifica al "pagador lento pero seguro" vs "deudor en erosión financiera".
    
    Categorías:
    - Pagador de Capital: Reduce activamente el saldo
    - Pagador Mínimo: Solo cubre intereses
    - Deudor en Erosión: Acumula intereses, no reduce capital
    
    Returns:
        score_c: Float entre 0 y 400 (40% de 1000)
    """
    cuotas = usuario.get('cuotas', [])
    monto_original = usuario.get('monto', 0)
    
    if not cuotas or monto_original == 0:
        return 200  # Score neutral sin historial
    
    total_capital_pagado = 0
    total_interes_pagado = 0
    total_pagado = 0
    
    for cuota in cuotas:
        if cuota['pagado']:
            capital = cuota.get('capital', 0)
            interes = cuota.get('interes', 0)
            monto_pagado = cuota.get('montoPagado', cuota.get('cuota', 0))
            
            total_capital_pagado += capital
            total_interes_pagado += interes
            total_pagado += monto_pagado
    
    if total_pagado == 0:
        return 0  # Sin pagos = máximo riesgo
    
    # Calcular ratio de amortización a capital
    ratio_capital = total_capital_pagado / total_pagado if total_pagado > 0 else 0
    
    # Calcular porcentaje de capital original amortizado
    porcentaje_capital_amortizado = total_capital_pagado / monto_original
    
    # Identificar tipo de pagador
    # "Pagador de Capital": ratio_capital >= 0.6 y amortiza constantemente
    # "Pagador Mínimo": ratio_capital entre 0.3 y 0.6
    # "Deudor en Erosión": ratio_capital < 0.3
    
    if ratio_capital >= 0.7:
        base_score = 400  # Excelente reductor de capital
    elif ratio_capital >= 0.6:
        base_score = 350
    elif ratio_capital >= 0.5:
        base_score = 280
    elif ratio_capital >= 0.4:
        base_score = 200
    elif ratio_capital >= 0.3:
        base_score = 120
    elif ratio_capital >= 0.2:
        base_score = 60
    else:
        base_score = 0  # Solo paga intereses (deudor en erosión)
    
    # Bonus por porcentaje de capital ya amortizado
    bonus = min(porcentaje_capital_amortizado * 100, 50)
    
    return min(base_score + bonus, 400)
```

**Tabla de Interpretación Variable C:**

| Ratio Capital/Pago | Score | Tipo de Pagador |
|--------------------|-------|-----------------|
| ≥70% | 400 | Excelente Reductor de Capital |
| 60-69% | 350 | Muy Buen Reductor |
| 50-59% | 280 | Buen Reductor |
| 40-49% | 200 | Pagador Equilibrado |
| 30-39% | 120 | Pagador Mínimo |
| 20-29% | 60 | Deudor en Erosión Leve |
| <20% | 0 | Deudor en Erosión Crítica |

---

### Variable D: Persistencia de Mora (15% del peso)
**Descripción:** Analiza el histórico de días de atraso (DPD - Days Past Due) promedio y su tendencia.

```python
def calcular_variable_d(usuario):
    """
    Evalúa si el comportamiento está mejorando o empeorando.
    
    Métricas:
    - DPD Promedio: Días promedio de atraso histórico
    - Tendencia: Comparación entre primeras y últimas cuotas
    
    Returns:
        score_d: Float entre 0 y 150 (15% de 1000)
    """
    cuotas = usuario.get('cuotas', [])
    hoy = datetime.now()
    
    if not cuotas:
        return 75  # Score neutral
    
    dias_atraso = []
    
    for cuota in cuotas:
        fecha_vencimiento = datetime.fromisoformat(cuota['fecha'])
        
        if cuota['pagado'] and cuota.get('fechaPago'):
            fecha_pago = datetime.fromisoformat(cuota['fechaPago'])
            dpd = max(0, (fecha_pago - fecha_vencimiento).days)
        elif not cuota['pagado']:
            dpd = max(0, (hoy - fecha_vencimiento).days)
        else:
            dpd = 0
        
        dias_atraso.append(dpd)
    
    if not dias_atraso:
        return 75
    
    # Calcular DPD promedio
    dpd_promedio = sum(dias_atraso) / len(dias_atraso)
    
    # Calcular tendencia (últimas 3 vs primeras 3)
    if len(dias_atraso) >= 6:
        primeras = sum(dias_atraso[:3]) / 3
        ultimas = sum(dias_atraso[-3:]) / 3
        tendencia = primeras - ultimas  # Positivo = mejorando
    else:
        tendencia = 0
    
    # Score base por DPD promedio
    if dpd_promedio == 0:
        base_score = 150
    elif dpd_promedio <= 5:
        base_score = 135
    elif dpd_promedio <= 15:
        base_score = 112
    elif dpd_promedio <= 30:
        base_score = 75
    elif dpd_promedio <= 60:
        base_score = 37
    elif dpd_promedio <= 90:
        base_score = 15
    else:
        base_score = 0
    
    # Ajuste por tendencia
    if tendencia > 10:
        tendencia_bonus = 20  # Mejorando significativamente
    elif tendencia > 5:
        tendencia_bonus = 10
    elif tendencia > 0:
        tendencia_bonus = 5
    elif tendencia < -10:
        tendencia_bonus = -20  # Empeorando significativamente
    elif tendencia < -5:
        tendencia_bonus = -10
    else:
        tendencia_bonus = 0
    
    return max(0, min(base_score + tendencia_bonus, 150))
```

**Tabla de Interpretación Variable D:**

| DPD Promedio | Score Base | Interpretación |
|--------------|------------|----------------|
| 0 días | 150 | Excelente: Siempre puntual |
| 1-5 días | 135 | Muy Bueno: Atrasos mínimos |
| 6-15 días | 112 | Bueno: Atrasos leves |
| 16-30 días | 75 | Regular: Atrasos moderados |
| 31-60 días | 37 | Deficiente: Atrasos significativos |
| 61-90 días | 15 | Crítico: Mora severa |
| >90 días | 0 | Default: Mora extrema |

---

## 3. Fórmula de Cálculo del Score Total

```python
def calcular_score_crediticio(usuario):
    """
    Fórmula principal para calcular el Score Crediticio.
    
    Ponderación (Weight of Evidence - WoE):
    - Variable A (Cumplimiento post-plazo): 20%
    - Variable B (Puntualidad post-quincena): 25%
    - Variable C (Comportamiento Capital vs Interés): 40%
    - Variable D (Histórico de mora): 15%
    
    Returns:
        dict: {
            'score': int (0-1000),
            'categoria': str (A/B/C/D),
            'nivel': str,
            'descripcion': str,
            'variables': dict,
            'recomendaciones': list
        }
    """
    # Calcular cada variable
    score_a = calcular_variable_a(usuario)  # Max 200
    score_b = calcular_variable_b(usuario)  # Max 250
    score_c = calcular_variable_c(usuario)  # Max 400
    score_d = calcular_variable_d(usuario)  # Max 150
    
    # Score total (0-1000)
    score_total = score_a + score_b + score_c + score_d
    
    # Categorización
    if score_total >= 800:
        categoria = 'A'
        nivel = 'bajo'
        descripcion = 'Riesgo Bajo - Cliente Premium'
    elif score_total >= 600:
        categoria = 'B'
        nivel = 'medio'
        descripcion = 'Riesgo Medio - Cliente Estándar'
    elif score_total >= 400:
        categoria = 'C'
        nivel = 'alto'
        descripcion = 'Riesgo Alto - Requiere Monitoreo'
    else:
        categoria = 'D'
        nivel = 'critico'
        descripcion = 'Riesgo Crítico - Atención Inmediata'
    
    # Generar recomendaciones
    recomendaciones = generar_recomendaciones(
        score_total, score_a, score_b, score_c, score_d
    )
    
    return {
        'score': round(score_total),
        'categoria': categoria,
        'nivel': nivel,
        'descripcion': descripcion,
        'variables': {
            'A_post_plazo': {'score': score_a, 'max': 200, 'peso': '20%'},
            'B_sensibilidad_quincenal': {'score': score_b, 'max': 250, 'peso': '25%'},
            'C_capital_vs_interes': {'score': score_c, 'max': 400, 'peso': '40%'},
            'D_persistencia_mora': {'score': score_d, 'max': 150, 'peso': '15%'}
        },
        'recomendaciones': recomendaciones
    }
```

---

## 4. Segmentación de Riesgo

| Categoría | Rango Score | Nivel | Descripción | Acción Recomendada |
|-----------|-------------|-------|-------------|-------------------|
| **A** | 800-1000 | Bajo | Cliente Premium | Ofrecer mejores tasas, aumentar límite |
| **B** | 600-799 | Medio | Cliente Estándar | Monitoreo regular, mantener condiciones |
| **C** | 400-599 | Alto | Requiere Monitoreo | Cobranza preventiva, contacto frecuente |
| **D** | 0-399 | Crítico | Atención Inmediata | Plan de reestructuración, cobranza intensiva |

---

## 5. Lógica de Rechazo/Aprobación (Cut-off)

```python
def evaluar_aprobacion(usuario, monto_solicitado):
    """
    Define el punto de corte (Cut-off) para aprobación de créditos.
    
    Criterios de Rechazo Automático:
    1. Score < 300
    2. Variable C < 60 (solo paga intereses) Y Score < 500
    3. Variable B < 50 (siempre paga post-quincena) Y Score < 500
    4. Combinación: C < 100 AND B < 100 (erosión + flujo ajustado)
    
    Returns:
        dict: {
            'aprobado': bool,
            'monto_maximo': float,
            'tasa_sugerida': float,
            'motivo': str,
            'condiciones': list
        }
    """
    analisis = calcular_score_crediticio(usuario)
    score = analisis['score']
    var_b = analisis['variables']['B_sensibilidad_quincenal']['score']
    var_c = analisis['variables']['C_capital_vs_interes']['score']
    
    # Reglas de rechazo automático
    if score < 300:
        return {
            'aprobado': False,
            'monto_maximo': 0,
            'tasa_sugerida': None,
            'motivo': 'Score muy bajo - Alto riesgo de default',
            'condiciones': []
        }
    
    # Identificar "deudor en erosión financiera"
    if var_c < 60 and score < 500:
        return {
            'aprobado': False,
            'monto_maximo': 0,
            'tasa_sugerida': None,
            'motivo': 'Patrón de erosión financiera detectado - Solo paga intereses',
            'condiciones': []
        }
    
    # Flujo de caja crítico
    if var_b < 50 and score < 500:
        return {
            'aprobado': False,
            'monto_maximo': 0,
            'tasa_sugerida': None,
            'motivo': 'Flujo de caja insuficiente - Dependencia extrema de nómina',
            'condiciones': []
        }
    
    # Combinación peligrosa
    if var_c < 100 and var_b < 100:
        return {
            'aprobado': False,
            'monto_maximo': 0,
            'tasa_sugerida': None,
            'motivo': 'Combinación de riesgo: erosión + flujo ajustado',
            'condiciones': []
        }
    
    # Aprobación con condiciones según score
    if score >= 800:
        factor_monto = 1.2
        tasa_base = 0.08  # 8%
    elif score >= 600:
        factor_monto = 1.0
        tasa_base = 0.12  # 12%
    elif score >= 400:
        factor_monto = 0.7
        tasa_base = 0.18  # 18%
    else:
        factor_monto = 0.5
        tasa_base = 0.24  # 24%
    
    monto_maximo = monto_solicitado * factor_monto
    
    condiciones = []
    if score < 600:
        condiciones.append('Requiere aval o garantía adicional')
    if var_b < 150:
        condiciones.append('Se recomienda débito automático')
    if var_c < 200:
        condiciones.append('Establecer pagos mínimos a capital obligatorios')
    
    return {
        'aprobado': True,
        'monto_maximo': monto_maximo,
        'tasa_sugerida': tasa_base,
        'motivo': f'Aprobado - Categoría {analisis["categoria"]}',
        'condiciones': condiciones
    }
```

---

## 6. Detección de Usuarios Duplicados

```python
def detectar_duplicados(usuarios):
    """
    Identifica usuarios duplicados basándose en nombre y teléfono.
    Solo se toma el registro más reciente o con más historial.
    
    Returns:
        dict: {
            'usuarios_unicos': list,
            'duplicados_detectados': list,
            'usuarios_excluidos': list
        }
    """
    from collections import defaultdict
    
    # Normalizar nombres para comparación
    def normalizar_nombre(nombre):
        import unicodedata
        nombre = unicodedata.normalize('NFKD', nombre.lower())
        nombre = ''.join(c for c in nombre if not unicodedata.combining(c))
        return ' '.join(nombre.split())
    
    # Normalizar teléfonos
    def normalizar_telefono(telefono):
        return ''.join(filter(str.isdigit, str(telefono)))[-10:]
    
    # Agrupar por clave única (nombre + teléfono)
    grupos = defaultdict(list)
    
    for usuario in usuarios:
        nombre_norm = normalizar_nombre(usuario.get('nombre', ''))
        telefono_norm = normalizar_telefono(usuario.get('telefono', ''))
        clave = f"{nombre_norm}_{telefono_norm}"
        grupos[clave].append(usuario)
    
    usuarios_unicos = []
    duplicados_detectados = []
    usuarios_excluidos = []
    
    for clave, grupo in grupos.items():
        if len(grupo) == 1:
            usuarios_unicos.append(grupo[0])
        else:
            # Seleccionar el mejor registro
            # Criterio: más cuotas pagadas > más reciente
            grupo_ordenado = sorted(
                grupo,
                key=lambda u: (
                    sum(1 for c in u.get('cuotas', []) if c.get('pagado')),
                    u.get('id', 0)
                ),
                reverse=True
            )
            
            mejor = grupo_ordenado[0]
            excluidos = grupo_ordenado[1:]
            
            usuarios_unicos.append(mejor)
            duplicados_detectados.append({
                'clave': clave,
                'cantidad': len(grupo),
                'seleccionado': mejor.get('id'),
                'excluidos': [u.get('id') for u in excluidos]
            })
            usuarios_excluidos.extend(excluidos)
    
    return {
        'usuarios_unicos': usuarios_unicos,
        'duplicados_detectados': duplicados_detectados,
        'usuarios_excluidos': usuarios_excluidos
    }
```

---

## 7. Acciones de Cobranza Preventiva

### Para Segmento Post-Quincena (Variable B baja)

```python
ESTRATEGIAS_COBRANZA = {
    'pre_quincena': {
        'descripcion': 'Recordatorio 3 días antes de la quincena',
        'canal': ['SMS', 'WhatsApp'],
        'mensaje': 'Estimado {nombre}, su cuota de ${monto} vence el {fecha}. '
                   'Programe su pago para evitar intereses adicionales.',
        'frecuencia': 'Días 12 y 27 de cada mes'
    },
    'dia_nomina': {
        'descripcion': 'Notificación el día de nómina',
        'canal': ['WhatsApp', 'Email'],
        'mensaje': 'Hola {nombre}, hoy es día de pago. '
                   'Recuerde que su cuota de ${monto} está pendiente. '
                   '¡Pague hoy y mantenga su buen historial!',
        'frecuencia': 'Días 15 y 30/31 de cada mes'
    },
    'post_quincena_temprano': {
        'descripcion': 'Seguimiento día 2 post-quincena',
        'canal': ['Llamada', 'WhatsApp'],
        'mensaje': 'Estimado {nombre}, detectamos que su pago aún no ha sido '
                   'registrado. ¿Necesita ayuda para realizar la transacción?',
        'frecuencia': 'Días 17 y 2 de cada mes'
    },
    'erosion_financiera': {
        'descripcion': 'Contacto para clientes en erosión',
        'canal': ['Llamada directa'],
        'mensaje': 'Señor(a) {nombre}, hemos notado que sus pagos solo cubren '
                   'intereses. Nos gustaría ofrecerle un plan de reestructuración '
                   'que le permita reducir su deuda de forma efectiva.',
        'frecuencia': 'Mensual para Variable C < 100'
    }
}
```

---

## 8. Esquema de Base de Datos Sugerido

```sql
-- Tabla principal de scores
CREATE TABLE credit_scores (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    score_total INTEGER NOT NULL CHECK (score_total >= 0 AND score_total <= 1000),
    categoria CHAR(1) NOT NULL CHECK (categoria IN ('A', 'B', 'C', 'D')),
    nivel VARCHAR(20) NOT NULL,
    
    -- Variables desglosadas
    score_var_a INTEGER NOT NULL DEFAULT 0, -- Post-plazo (max 200)
    score_var_b INTEGER NOT NULL DEFAULT 0, -- Sensibilidad quincenal (max 250)
    score_var_c INTEGER NOT NULL DEFAULT 0, -- Capital vs Interés (max 400)
    score_var_d INTEGER NOT NULL DEFAULT 0, -- Persistencia mora (max 150)
    
    -- Metadata
    fecha_calculo TIMESTAMP NOT NULL DEFAULT NOW(),
    version_modelo VARCHAR(10) DEFAULT '2.0',
    
    -- Métricas adicionales
    dpd_promedio DECIMAL(5,2),
    ratio_capital DECIMAL(3,2),
    tasa_recuperacion_tardia DECIMAL(3,2),
    pagos_post_quincena_pct DECIMAL(3,2),
    
    -- Índices
    UNIQUE(usuario_id, fecha_calculo)
);

-- Historial de scores para tracking
CREATE TABLE score_history (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    score_anterior INTEGER,
    score_nuevo INTEGER NOT NULL,
    cambio INTEGER GENERATED ALWAYS AS (score_nuevo - COALESCE(score_anterior, 0)) STORED,
    motivo VARCHAR(255),
    fecha_cambio TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla de duplicados detectados
CREATE TABLE usuarios_duplicados (
    id SERIAL PRIMARY KEY,
    usuario_principal_id INTEGER REFERENCES usuarios(id),
    usuario_duplicado_id INTEGER REFERENCES usuarios(id),
    clave_duplicado VARCHAR(255),
    fecha_deteccion TIMESTAMP DEFAULT NOW(),
    accion_tomada VARCHAR(50), -- 'merged', 'excluded', 'pending'
    UNIQUE(usuario_principal_id, usuario_duplicado_id)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_scores_usuario ON credit_scores(usuario_id);
CREATE INDEX idx_scores_categoria ON credit_scores(categoria);
CREATE INDEX idx_scores_fecha ON credit_scores(fecha_calculo);
CREATE INDEX idx_scores_nivel ON credit_scores(nivel);
```

---

## 9. API Endpoints Sugeridos

```yaml
# OpenAPI/Swagger specification

/api/v2/score/{usuario_id}:
  get:
    summary: Obtener score crediticio de un usuario
    responses:
      200:
        schema:
          type: object
          properties:
            score: integer
            categoria: string
            nivel: string
            variables: object

/api/v2/score/{usuario_id}/recalculate:
  post:
    summary: Recalcular score de un usuario
    responses:
      200:
        schema:
          $ref: '#/definitions/ScoreResponse'

/api/v2/score/batch:
  post:
    summary: Calcular scores para múltiples usuarios
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              usuario_ids: array

/api/v2/duplicados/detectar:
  post:
    summary: Detectar usuarios duplicados
    responses:
      200:
        schema:
          type: object
          properties:
            usuarios_unicos: integer
            duplicados_encontrados: integer
            detalle: array

/api/v2/cobranza/estrategia/{usuario_id}:
  get:
    summary: Obtener estrategia de cobranza recomendada
    responses:
      200:
        schema:
          type: object
          properties:
            estrategia: string
            canal_preferido: string
            mensaje_sugerido: string
            frecuencia: string
```

---

## 10. Ejemplos de Interpretación

### Ejemplo 1: "Pagador Lento pero Seguro"
```
Usuario: Juan Pérez
Score: 720 (Categoría B)
- Variable A: 140/200 (pagos ocasionalmente post-plazo)
- Variable B: 125/250 (paga después de quincena)
- Variable C: 350/400 (buen reductor de capital)
- Variable D: 105/150 (atrasos leves pero mejorando)

Interpretación: Cliente que paga tarde pero siempre reduce su deuda.
Recomendación: Débito automático el día de nómina.
```

### Ejemplo 2: "Deudor en Erosión Financiera"
```
Usuario: María López
Score: 280 (Categoría D)
- Variable A: 50/200 (mayoría pagos post-plazo)
- Variable B: 30/250 (siempre paga post-quincena)
- Variable C: 40/400 (solo paga intereses)
- Variable D: 160/150 (empeorando)

Interpretación: Cliente que solo paga intereses para evitar bloqueo.
Recomendación: Plan de reestructuración urgente.
```

---

## 11. Notas de Implementación

1. **Actualización del Score:** Recalcular después de cada pago registrado
2. **Caché:** Mantener el último score calculado para consultas rápidas
3. **Auditoría:** Registrar todos los cambios en `score_history`
4. **Duplicados:** Ejecutar detección diariamente o al registrar nuevos usuarios
5. **Performance:** Para lotes grandes, usar procesamiento asíncrono

---

*Documento generado automáticamente - CreditoFuturo v2.0*
