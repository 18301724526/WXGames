# Dev-time mojibake scanner (Windows PowerShell; needs the GBK/936 codepage).
#
# Detects "UTF-8 bytes mis-decoded as GBK" mojibake DETERMINISTICALLY: for every
# non-ASCII run, it round-trips the run through GBK(936) <-> UTF-8 and only
# reports a hit when the recovery is pure CJK AND re-corrupting it reproduces the
# exact garbled bytes. That round-trip + "recovered must be real CJK" filter is
# what separates genuine mojibake (鍙湁->只有) from legit Chinese that merely
# happens to be GBK-encodable (知识->֪ʶ, a FALSE positive we must reject).
#
# This is a DEV tool only -- the Linux CI gate cannot rely on the GBK codepage,
# so the portable regression lock lives in scripts/check-source-encoding.js.
#
# Usage:  powershell -File scripts/scan-mojibake.ps1
# Exit 1 if any mojibake remains (so it can gate locally too).

$ErrorActionPreference = 'Stop'
$gbk = [Text.Encoding]::GetEncoding(936)
$utf8 = [Text.Encoding]::UTF8
$utf8Strict = New-Object Text.UTF8Encoding($false, $true)
$root = (Resolve-Path "$PSScriptRoot\..").Path
$files = Get-ChildItem -Path "$root\backend", "$root\frontend", "$root\shared" -Recurse -Filter *.js -File |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\vendor\\' -and $_.Name -notlike '*.test.js' }
$run = [regex]'[^\x00-\x7F]+'
$pureCjk = [regex]'^[一-鿿㐀-䶿]{2,}$'
$hits = @()
foreach ($f in $files) {
  $text = [IO.File]::ReadAllText($f.FullName, $utf8)
  foreach ($m in $run.Matches($text)) {
    $s = $m.Value
    try { $rec = $utf8Strict.GetString($gbk.GetBytes($s)) } catch { continue }
    if ($rec -ne $s -and $pureCjk.IsMatch($rec)) {
      try { $back = $gbk.GetString($utf8.GetBytes($rec)) } catch { continue }
      if ($back -eq $s) {
        $rel = $f.FullName.Substring($root.Length + 1)
        $hits += [pscustomobject]@{ file = $rel; garbled = $s; recovered = $rec }
      }
    }
  }
}
if ($hits.Count -eq 0) {
  Write-Output '[scan-mojibake] clean: no UTF8-as-GBK mojibake found'
  exit 0
}
Write-Output "[scan-mojibake] FOUND $($hits.Count) mojibake string(s):"
$hits | Sort-Object file | ForEach-Object { Write-Output "  [$($_.file)]  '$($_.garbled)' => '$($_.recovered)'" }
exit 1
