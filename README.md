# Home Assistant Fake Server für ioBroker

Ein minimaler Home-Assistant-Emulator für ioBroker.

Dieser Adapter ermöglicht es Geräten, die ausschließlich ein
Home-Assistant-Dashboard anzeigen können, einen Home-Assistant-Server
vorzutäuschen und stattdessen eine beliebige Web-URL bereitzustellen.

Die Implementierung wurde vollständig mit Unterstützung von Claude.ai
erstellt.

------------------------------------------------------------------------

## Ziel

Geräte wie das **Shelly Wall Display XL** erlauben offiziell nur die
Verbindung zu einem Home Assistant Server.

Mit dieser Bridge kann stattdessen z. B.:

-   eine ioBroker VIS\
-   eine VIS-2 Instanz\
-   ein eigenes Dashboard\
-   oder eine beliebige interne/externe Web-Applikation

angezeigt werden --- **ohne echten Home Assistant Core**.

------------------------------------------------------------------------

## Getestet mit

-   Shelly Wall Display XL

Damit lässt sich eine ioBroker VIS nativ auf dem Wall Display betreiben.

------------------------------------------------------------------------

## Funktionsweise (Kurzfassung)

Der Adapter:

-   emuliert relevante Home Assistant API-Endpunkte\
-   stellt einen `_home-assistant._tcp` mDNS-Service bereit\
-   implementiert einen minimalen Auth-Flow\
-   leitet nach erfolgreicher Anmeldung auf die konfigurierte Ziel-URL
    weiter

Das Display erkennt die Bridge als Home Assistant Server.

------------------------------------------------------------------------

## mDNS Hinweis

Der Adapter registriert einen `_home-assistant._tcp` Service via Avahi,
sodass eine automatische Erkennung per mDNS möglich sein sollte.

In meinen Tests hat die automatische Discovery jedoch nicht zuverlässig
funktioniert.

Die manuelle Einrichtung funktioniert dagegen stabil:

    IP:   <IP-des-ioBroker>
    Port: 8123

Über die direkte IP-Eingabe verbindet sich das Display zuverlässig mit
der Bridge.

------------------------------------------------------------------------

## Voraussetzungen

-   Node.js ≥ 18\
-   ioBroker js-controller ≥ 5\
-   Linux-System mit Avahi (für mDNS)

------------------------------------------------------------------------
