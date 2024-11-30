```Mermaid
    stateDiagram-v2
    [*] --> ExtensionInstallée
    
    ExtensionInstallée --> PremièreOuverture: Click sur l'icône
    
    PremièreOuverture --> NonConnecté: Initialisation Popup
    NonConnecté --> Connexion: Click "Se connecter avec Google"
    Connexion --> Authentifié: Authentification réussie
    
    Authentifié --> SyncInitiale: Première synchronisation
    SyncInitiale --> DonnéesLocalesExistantes: Vérification localStorage anime-sama
    SyncInitiale --> AucuneDonnéeLocale: Pas de localStorage
    
    DonnéesLocalesExistantes --> EnvoiDonnéesServeur: Première sync
    AucuneDonnéeLocale --> RécupérationDonnéesServeur: Première sync
    
    state SyncContinue {
        RécupérationDonnéesServeur --> MiseÀJourLocale
        EnvoiDonnéesServeur --> MiseÀJourLocale
        MiseÀJourLocale --> AttenteChangement
        AttenteChangement --> DétectionChangement: Changement localStorage
        DétectionChangement --> RécupérationDonnéesServeur
    }
```