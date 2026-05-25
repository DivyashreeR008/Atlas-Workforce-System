param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$AuthUrl = "http://localhost:8010",
    [string]$Email = "admin@atlas.io",
    [string]$Password = "ChangeMe123!"
)

function Get-Token {
    param($Email, $Password)
    $tmp = "$env:TEMP\seed_login.json"
    Set-Content -Path $tmp -Value "{`"email`":`"$Email`",`"password`":`"$Password`"}" -Encoding Ascii
    $r = & curl.exe -s -X POST "$AuthUrl/login" -H "Content-Type: application/json" --data-binary "@$tmp"
    return ($r | ConvertFrom-Json).token
}

function Invoke-Api {
    param($Method, $Url, $Body, $Token)
    if ($Body) {
        $guid = [Guid]::NewGuid().ToString("N")
        $tmp = "$env:TEMP\seed_$guid.json"
        Set-Content -Path $tmp -Value $Body -Encoding Ascii
        $r = & curl.exe -s -X $Method $Url -H "Content-Type: application/json" -H "Authorization: Bearer $Token" --data-binary "@$tmp"
    } else {
        $r = & curl.exe -s -X $Method $Url -H "Authorization: Bearer $Token"
    }
    return $r
}

$token = Get-Token -Email $Email -Password $Password
Write-Output "Token: $($token.Substring(0,20))..."

$departments = @("Engineering","Sales","Marketing","Finance","Human Resources","Operations")
$positions = @{
    "Engineering"       = @("Software Engineer","Senior Developer","Frontend Developer","Backend Developer","DevOps Engineer","Tech Lead","Engineering Manager")
    "Sales"             = @("Sales Representative","Account Manager","Sales Director","Business Development")
    "Marketing"         = @("Marketing Specialist","Content Writer","Marketing Manager","SEO Analyst")
    "Finance"           = @("Financial Analyst","Accountant","Finance Manager","CFO")
    "Human Resources"   = @("HR Coordinator","Recruiter","HR Manager","HR Director")
    "Operations"        = @("Operations Analyst","Operations Manager","Logistics Coordinator","COO")
}

$firstNames = @("Sarah","James","Maria","David","Emily","Michael","Jessica","Robert","Amy","William","Jennifer","Daniel","Lisa","John","Michelle","Christopher")
$lastNames  = @("Chen","Wilson","Garcia","Kim","Johnson","Brown","Davis","Miller","Anderson","Taylor","Thomas","Jackson","White","Harris","Martin","Thompson")

$employees = @()
$employeeIds = @()

Write-Output "`n=== Creating 20 Employees ==="
for ($i = 0; $i -lt 20; $i++) {
    $first = $firstNames[$i % $firstNames.Length]
    $last  = $lastNames[$i % $lastNames.Length]
    $dept  = $departments[$i % $departments.Length]
    $pos   = $positions[$dept][$i % $positions[$dept].Length]
    $email = "$($first.ToLower()).$($last.ToLower())$($i)@atlas.io"
    $body  = "{`"name`":`"$first $last`",`"email`":`"$email`",`"department`":`"$dept`",`"position`":`"$pos`"}"
    
    try {
        $result = Invoke-Api -Method POST -Url "$BaseUrl/api/employee/employees" -Body $body -Token $token
        Write-Output "  [$($i+1)/20] $first $last ($dept - $pos)"
        $employees += @{Name="$first $last"; Email=$email; Dept=$dept}
        $employeeIds += $email
    } catch {
        Write-Output "  [SKIP] $email (may already exist)"
    }
    Start-Sleep -Milliseconds 50
}

Write-Output "`n=== Creating Leave Requests ==="
$leaveTypes = @("VACATION","SICK","PERSONAL")
$today = Get-Date
$leaveCount = 0

for ($i = 0; $i -lt [Math]::Min(12, $employeeIds.Count); $i++) {
    $empEmail = $employeeIds[$i]
    $leaveType = $leaveTypes[$i % $leaveTypes.Length]
    $days = 1..5 | Get-Random
    $startDate = $today.AddDays(-20 + $i * 2).ToString("yyyy-MM-dd")
    $endDate = $today.AddDays(-20 + $i * 2 + $days - 1).ToString("yyyy-MM-dd")
    
    $body = "{`"employeeId`":`"$empEmail`",`"startDate`":`"$startDate`",`"endDate`":`"$endDate`",`"leaveType`":`"$leaveType`",`"reason`":`"Seeded leave request $($i+1)`"}"
    
    try {
        $result = Invoke-Api -Method POST -Url "$BaseUrl/api/leave/request" -Body $body -Token $token
        Write-Output "  Leave: $empEmail - $leaveType ($startDate to $endDate)"
        $leaveCount++
    } catch {
        Write-Output "  [FAIL] Leave for $empEmail"
    }
    Start-Sleep -Milliseconds 50
}

Write-Output "`n=== Creating Attendance Records ==="
$attCount = 0
for ($i = 0; $i -lt [Math]::Min(15, $employeeIds.Count); $i++) {
    $empEmail = $employeeIds[$i]
    $daysBack = Get-Random -Minimum 0 -Maximum 14
    $clockDate = $today.AddDays(-$daysBack).ToString("yyyy-MM-dd")
    
    $body = "{`"employeeId`":`"$empEmail`",`"localDate`":`"$clockDate`"}"
    
    try {
        $result = Invoke-Api -Method POST -Url "$BaseUrl/api/attendance/clock-in" -Body $body -Token $token
        Write-Output "  Clock-in: $empEmail on $clockDate"
        $attCount++
    } catch {
        # already clocked in, skip
    }
    Start-Sleep -Milliseconds 50
    
    if ((Get-Random -Max 2) -eq 0) {
        try {
            $result = Invoke-Api -Method POST -Url "$BaseUrl/api/attendance/clock-out" -Body $body -Token $token
            Write-Output "  Clock-out: $empEmail on $clockDate"
        } catch {}
        Start-Sleep -Milliseconds 50
    }
}

Write-Output "`n=== Running Payroll ==="
$payCount = 0
for ($i = 0; $i -lt [Math]::Min(10, $employeeIds.Count); $i++) {
    $empEmail = $employeeIds[$i]
    $baseSalary = 5000 + (Get-Random -Maximum 5000)
    $allowances = Get-Random -Maximum 800
    $deductions = Get-Random -Maximum 400
    
    $body = "{`"employeeId`":`"$empEmail`",`"period`":`"2026-05`",`"baseSalary`":$baseSalary,`"allowances`":$allowances,`"deductions`":$deductions}"
    
    try {
        $result = Invoke-Api -Method POST -Url "$BaseUrl/api/payroll/run" -Body $body -Token $token
        Write-Output "  Payroll: $empEmail - period 2026-05 (base: $baseSalary)"
        $payCount++
    } catch {
        Write-Output "  [SKIP] Payroll for $empEmail (may already exist)"
    }
    Start-Sleep -Milliseconds 50
}

Write-Output "`n=== Seed Complete ==="
Write-Output "  Employees: 20"
Write-Output "  Leave Requests: $leaveCount"
Write-Output "  Attendance Records: $attCount"
Write-Output "  Payroll Runs: $payCount"
