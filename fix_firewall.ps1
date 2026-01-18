
# Script to allow Port 8000 AND Python executable through Windows Firewall
# Please Run as Administrator

$PythonPath = "C:\Users\hemra\AppData\Local\Programs\Python\Python310\python.exe"
$PortRuleName = "Chatbot Web Server 8000"
$AppRuleName = "Chatbot Python Server"
$Port = 8000

Write-Host "Configuring Windows Firewall..." -ForegroundColor Cyan

# 1. Port Rule
$existingPort = Get-NetFirewallRule -DisplayName $PortRuleName -ErrorAction SilentlyContinue
if ($existingPort) {
    Write-Host "Updating Port Rule '$PortRuleName'..."
    Set-NetFirewallRule -DisplayName $PortRuleName -Action Allow -Enabled True -Direction Inbound -Profile Any
} else {
    Write-Host "Creating Port Rule '$PortRuleName'..."
    New-NetFirewallRule -DisplayName $PortRuleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -Profile Any
}

# 2. Application Rule
$existingApp = Get-NetFirewallRule -DisplayName $AppRuleName -ErrorAction SilentlyContinue
if ($existingApp) {
    Write-Host "Updating Application Rule '$AppRuleName'..."
    Set-NetFirewallRule -DisplayName $AppRuleName -Program $PythonPath -Action Allow -Enabled True -Direction Inbound -Profile Any
} else {
    Write-Host "Creating Application Rule '$AppRuleName'..."
    New-NetFirewallRule -DisplayName $AppRuleName -Program $PythonPath -Direction Inbound -Action Allow -Profile Any
}

Write-Host "-----------------------------------------------------"
Write-Host "SUCCESS: Firewall rules updated." -ForegroundColor Green
Write-Host "-----------------------------------------------------"
Write-Host "Troubleshooting Tips if it STILL doesn't work:" -ForegroundColor Yellow
Write-Host "1. Anti-Virus: If you have Norton, McAfee, BitDefender, etc., YOU MUST open Port 8000 in THEIR settings."
Write-Host "   (Windows Firewall rules do generally not apply to 3rd party Antivirus)"
Write-Host ""
Write-Host "2. Network Isolation: Some Guest Wi-Fi networks prevent devices from talking to each other."
Write-Host ""
Write-Host "Try accessing: http://$((Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias *Wi-Fi*).IPAddress):$Port" -ForegroundColor White

Read-Host -Prompt "Press Enter to exit"
