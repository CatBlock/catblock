@ECHO OFF

SET SourcePath="%CD%\catblock"

ECHO Attempting to set access permissions on directory . . .
ECHO.
icacls %SourcePath% /grant "*S-1-15-2-3624051433-2125758914-1423191267-1740899205-1073925389-3782572162-737981194":"(OI)(CI)(WDAC,WO,GE)"

ECHO Opening instructions . . .
ECHO.
start notepad .\instructions.txt

EXIT
