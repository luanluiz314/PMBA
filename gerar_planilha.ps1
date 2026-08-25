$subjects = @(
    @{ name="Língua Portuguesa"; type="gerais"; priority=4 },
    @{ name="Matemática"; type="gerais"; priority=4 },
    @{ name="História do Brasil"; type="gerais"; priority=2 },
    @{ name="Geografia do Brasil"; type="gerais"; priority=2 },
    @{ name="Atualidades"; type="gerais"; priority=2 },
    @{ name="Informática"; type="gerais"; priority=2 },
    @{ name="Direito Constitucional"; type="especificos"; priority=2 },
    @{ name="Direitos Humanos"; type="especificos"; priority=2 },
    @{ name="Direito Administrativo"; type="especificos"; priority=2 },
    @{ name="Direito Penal"; type="especificos"; priority=2 },
    @{ name="Igualdade Racial e de Gênero"; type="especificos"; priority=2 },
    @{ name="Direito Penal Militar"; type="especificos"; priority=2 }
)

$pool = @()
$pool += $subjects | Sort-Object priority -Descending

$hours = 3
$days = 60
$csv = "Dia,Tarefa 1 (30m),Tarefa 2 (30m),Bloco 1 (1h),Bloco 2 (1h),Bloco 3 (1h)`n"

$lastType = $null

for ($d = 1; $d -le $days; $d++) {
    $line = "Dia $d,Revisão Anki (30m),Resumos 24h (30m),"
    
    $hoursToDraw = $hours
    $blocks = @()

    if ($d % 7 -eq 0) {
        $blocks += "Prática Discursiva (Redação)"
        $hoursToDraw--
    }

    for ($h = 0; $h -lt $hoursToDraw; $h++) {
        $bestIndex = -1
        for ($i = 0; $i -lt $pool.Count; $i++) {
            if ($pool[$i].type -ne $lastType) {
                $bestIndex = $i
                break
            }
        }
        if ($bestIndex -eq -1) { $bestIndex = 0 }
        
        $selected = $pool[$bestIndex]
        
        $newPool = @()
        for ($i = 0; $i -lt $pool.Count; $i++) {
            if ($i -ne $bestIndex) { $newPool += $pool[$i] }
        }
        $pool = $newPool
        
        $blocks += $selected.name
        $lastType = $selected.type

        if ($pool.Count -eq 0) {
            $pool += $subjects | Sort-Object priority -Descending
        }
    }
    
    while ($blocks.Count -lt 3) {
        $blocks += "-"
    }
    
    $line += ($blocks -join ",")
    $csv += $line + "`n"
}

$csv | Out-File -FilePath "$env:USERPROFILE\Desktop\Cronograma_PMBA_60_Dias.csv" -Encoding UTF8
Write-Output "Planilha gerada com sucesso na Área de Trabalho!"
