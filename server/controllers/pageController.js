/**
 * Crée les handlers des pages EJS.
 * @param {import("../services/userService.js").UserService} userService Service utilisateur
 * @param {import("../repositories/calendarRepository.js").CalendarRepository} calendarRepository Repository calendrier
 * @returns {{ createAccount: import("express").RequestHandler, createCalendar: import("express").RequestHandler,
 * menu: import("express").RequestHandler, login: import("express").RequestHandler,
 * calendar: import("express").RequestHandler }}
 */
export function createPageController(userService, calendarRepository) {
    return {
        createAccount(req, res) {
            return res.render("creation-compte", {
                title: "Créer un compte",
            });
        },

        createCalendar(req, res) {
            try {
                const user = userService.verifyAccessToken(req.cookies?.accessToken);
                if (!calendarRepository.userExists(user.id)) return res.redirect("/");
            } catch {
                return res.redirect("/");
            }

            return res.render("creation-agenda", {
                title: "Créer un agenda",
            });
        },

        menu(req, res) {
            return res.render("menu", {
                title: "Mes agendas",
            });
        },

        login(req, res) {
            try {
                const user = userService.verifyAccessToken(req.cookies?.accessToken);
                if (calendarRepository.userExists(user.id)) return res.redirect("/");
            } catch {
                // Une session absente ou expirée permet d'afficher la page de connexion.
            }

            return res.render("login", {
                title: "Se connecter",
            });
        },

        calendar(req, res) {
            try {
                const user = userService.verifyAccessToken(req.cookies?.accessToken);
                if (!calendarRepository.userExists(user.id)) return res.redirect("/connexion");
            } catch {
                return res.redirect("/connexion");
            }

            return res.render("calendrier", {
                title: "Agenda",
                calendarId: req.params.calendarId,
            });
        }
    };
}
