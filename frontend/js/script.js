(function () {
    var menuToggle = document.getElementById("menuToggle");
    var primaryNav = document.getElementById("primaryNav");

    function setMenuOpen(open) {
        if (!menuToggle || !primaryNav) return;

        menuToggle.classList.toggle("is-open", open);
        primaryNav.classList.toggle("is-open", open);
        menuToggle.setAttribute("aria-expanded", String(open));
        menuToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    }

    if (menuToggle && primaryNav) {
        menuToggle.addEventListener("click", function () {
            setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
        });

        primaryNav.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                setMenuOpen(false);
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") setMenuOpen(false);
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth > 740) setMenuOpen(false);
        });
    }

})();
