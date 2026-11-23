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

    var form = document.getElementById("reportForm");
    var description = document.getElementById("description");
    var incidentDate = document.getElementById("incidentDate");
    var characterCount = document.getElementById("characterCount");
    var formMessage = document.getElementById("formMessage");
    var previewButton = document.getElementById("previewButton");
    var demoEnabled = window.VIO_CONFIG && window.VIO_CONFIG.mode === "demo";

    if (!form || !description || !characterCount || !formMessage || !previewButton || !demoEnabled) return;

    function localDateString(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, "0");
        var day = String(date.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function updateCharacterCount() {
        characterCount.textContent = description.value.length.toLocaleString("en") + " / 2,000";
    }

    if (incidentDate) {
        incidentDate.max = localDateString(new Date());
    }

    updateCharacterCount();
    description.addEventListener("input", updateCharacterCount);

    form.addEventListener("input", function () {
        if (!formMessage.hidden) {
            formMessage.hidden = true;
            formMessage.textContent = "";
        }
    });

    previewButton.addEventListener("click", function () {
        var invalidField = form.querySelector(":invalid");
        if (invalidField) {
            invalidField.reportValidity();
            return;
        }

        if (description.value.trim().length < 20) {
            description.setCustomValidity("Please enter at least 20 non-space characters.");
            description.reportValidity();
            description.setCustomValidity("");
            return;
        }

        formMessage.textContent =
            "Demo preview complete. Nothing was sent or saved. In a live VIO service, a report would be assessed before any tracking status is shown.";
        formMessage.hidden = false;
    });
})();
