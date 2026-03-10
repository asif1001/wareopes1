$path = "C:\wareopes_fix\src\lib\firebase\firestore.ts"
$content = Get-Content $path -Raw

# Regex to match the block in getClearedShipmentsMonthlySummary
# matches "return {" followed by whitespace, then monthlyData line with incorrect type
$pattern = "return \{\s+monthlyData: toArray\(monthlySummary, 'month', sortMonths\) as \{ month: string; containers: number \}\[\],\s+weeklyData: toArray\(weeklySummary, 'week', sortWeeks\) as \{ week: string; containers: number \}\[\],\s+yearlyData: toArray\(yearlySummary, 'year', sortYears\) as \{ year: string; containers: number \}\[\],"

$replacement = "return {
            monthlyData: toArray(monthlySummary, 'month', sortMonths) as { month: string; domLines: number; bulkLines: number }[],
            weeklyData: toArray(weeklySummary, 'week', sortWeeks) as { week: string; domLines: number; bulkLines: number }[],
            yearlyData: toArray(yearlySummary, 'year', sortYears) as { year: string; domLines: number; bulkLines: number }[],"

$content = [Regex]::Replace($content, $pattern, $replacement)
Set-Content -Path $path -Value $content -Encoding UTF8
