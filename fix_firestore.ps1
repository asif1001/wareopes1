$path = "C:\wareopes_fix\src\lib\firebase\firestore.ts"
$content = Get-Content $path -Raw
$content = $content -replace "monthlyData: toArray\(monthlySummary, 'month', sortMonths\)", "monthlyData: toArray(monthlySummary, 'month', sortMonths) as { month: string; containers: number }[]"
$content = $content -replace "weeklyData: toArray\(weeklySummary, 'week', sortWeeks\)", "weeklyData: toArray(weeklySummary, 'week', sortWeeks) as { week: string; containers: number }[]"
$content = $content -replace "yearlyData: toArray\(yearlySummary, 'year', sortYears\)", "yearlyData: toArray(yearlySummary, 'year', sortYears) as { year: string; containers: number }[]"
Set-Content -Path $path -Value $content -Encoding UTF8
