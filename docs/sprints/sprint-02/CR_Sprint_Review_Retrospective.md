# Sprint Review

Sur les cinq fonctionnalités prévues pour ce sprint, les cinq ont été réalisées. Les trois fonctionnalités reportées du sprint 1 (création d’un agenda, visualisation à la semaine et gestion des rendez-vous) disposent maintenant de leur interface frontend, et les deux nouvelles fonctionnalités du sprint (menu principal et vues jour/mois) ont été ajoutées.

| ID | Fonctionnalité | Priorité | Sprint | Avancement |
|---:|---|---:|:---:|---:|
| 1 | Création d’un agenda | 5 | 1/2 | Terminée |
| 2 | Visualisation d’un agenda à la semaine | 5 | 1/2 | Terminée |
| 3 | Ajout, suppression et modification des rendez-vous | 5 | 1/2 | Terminée |
| 4 | Ajout du menu principal | 3 | 2 | Terminée |
| 5 | Visualisation d’un agenda à la journée et au mois | 3 | 2 | Terminée |

Pour la création d’un agenda, une page dédiée permet désormais à l’utilisateur de créer son agenda depuis le menu principal.
Le menu principal regroupe l’accès aux agendas de l’utilisateur ainsi que le bouton de déconnexion, ce qui termine aussi la déconnexion restée en suspens au sprint 1.
Côté backend, la route de récupération d’un calendrier a été généralisée pour renvoyer les rendez-vous selon une période donnée (jour, semaine ou mois), ce qui a permis d’ajouter les vues jour et mois en plus de la vue semaine.
Les rendez-vous peuvent maintenant être ajoutés (bouton +), modifiés et supprimés directement depuis le calendrier, selon les droits de l’utilisateur sur l’agenda (propriétaire ou éditeur).

# Sprint Retrospective

Nous avons rattrapé le retard du sprint 1 : toutes les fonctionnalités dont seul le backend existait ont maintenant leur interface, et l’application est utilisable de bout en bout (inscription, connexion, création d’un agenda, gestion des rendez-vous, déconnexion).

Le découpage entre backend et frontend décidé lors de la rétrospective précédente a bien fonctionné. La généralisation de la route calendrier par période a été faite en amont, ce qui a permis de développer les vues jour, semaine et mois sans modifier à nouveau le backend. Cette façon de travailler est à conserver.

En revanche, nous n’avons pas réglé le problème de régularité. Après la mise en place du backlog au début du sprint, la quasi-totalité du développement s’est concentrée sur les derniers jours, ce qui a de nouveau entraîné un rush en fin de sprint. Le suivi sur GitHub Projects n’a pas été assez mis à jour pour repérer ce retard plus tôt.

Pour le prochain sprint, nous devons fixer des points d’avancement intermédiaires (par exemple lors des séances du jeudi après-midi) avec un objectif concret à atteindre à chaque point, et mettre à jour le tableau Kanban à chaque séance. Nous devons aussi intégrer plus tôt les branches entre elles : la vue calendrier a dû être reprise à partir du travail d’un autre membre de l’équipe, ce qui aurait pu être évité avec des merges plus fréquents.
