(function () {
    var universitySelect = document.getElementById("university");
    var emailInput = document.getElementById("email");
    var codeInput = document.getElementById("verificationCode");
    var emailStep = document.getElementById("emailStep");
    var codeStep = document.getElementById("codeStep");
    var errorBox = document.getElementById("authError");
    var successBox = document.getElementById("authSuccess");
    var requestButton = document.getElementById("requestCode");
    var verifyButton = document.getElementById("verifyCode");
    var resendButton = document.getElementById("resendCode");
    var resendTimer = document.getElementById("resendTimer");
    var challengeId = null;
    var resendAt = null;
    var countdown = null;
    var enteredEmail = "";

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        successBox.hidden = true;
    }

    function clearMessages() {
        errorBox.hidden = true;
        successBox.hidden = true;
        errorBox.textContent = "";
        successBox.textContent = "";
    }

    function setBusy(button, busy, label) {
        button.disabled = busy;
        button.classList.toggle("app-button-loading", busy);
        if (label) button.dataset.idleLabel = label;
        button.textContent = busy ? "Please wait…" : button.dataset.idleLabel;
    }

    function startCountdown() {
        if (countdown) window.clearInterval(countdown);
        resendButton.disabled = true;

        function update() {
            var remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
            resendTimer.textContent = remaining > 0
                ? "You can request another code in " + remaining + "s"
                : "Didn’t receive it?";
            resendButton.disabled = remaining > 0;
            if (remaining === 0 && countdown) {
                window.clearInterval(countdown);
                countdown = null;
            }
        }

        update();
        countdown = window.setInterval(update, 1000);
    }

    async function loadUniversities() {
        try {
            var universities = await window.VioApi.get("/universities");
            universitySelect.replaceChildren(new Option("Choose your university", ""));
            universities.forEach(function (university) {
                universitySelect.add(new Option(university.name, university.id));
            });
            if (universities.length === 0) {
                showError("Student sign-in is not available for a university yet.");
            }
        } catch (error) {
            universitySelect.replaceChildren(new Option("University list unavailable", ""));
            showError(error.message);
        }
    }

    async function requestCode() {
        clearMessages();
        if (!universitySelect.value) {
            universitySelect.reportValidity();
            return;
        }
        if (!emailInput.checkValidity()) {
            emailInput.reportValidity();
            return;
        }

        try {
            sessionStorage.setItem("vioUniversityId", universitySelect.value);
        } catch (error) {
            showError("Your browser cannot keep the university selection for this sign-in. Enable session storage and try again.");
            return;
        }

        enteredEmail = emailInput.value.trim();
        setBusy(requestButton, true, "Send verification code →");
        try {
            var result = await window.VioApi.post("/auth/student/email-challenges", {
                university_id: universitySelect.value,
                email: enteredEmail
            });
            challengeId = result.challenge_id;
            resendAt = Date.parse(result.resend_at);
            document.getElementById("maskedDestination").textContent =
                "Enter the code sent to " + result.masked_destination + ".";
            emailStep.hidden = true;
            codeStep.hidden = false;
            codeInput.value = "";
            codeInput.focus();
            successBox.textContent = "If the address is eligible, a verification code has been sent.";
            successBox.hidden = false;
            startCountdown();
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(requestButton, false);
        }
    }

    async function verifyCode() {
        clearMessages();
        if (!challengeId) {
            showError("Request a new verification code to continue.");
            return;
        }
        if (!codeInput.checkValidity()) {
            codeInput.reportValidity();
            return;
        }

        setBusy(verifyButton, true, "Verify and continue →");
        try {
            await window.VioApi.post("/auth/student/email-challenges/verify", {
                challenge_id: challengeId,
                code: codeInput.value
            });
            window.location.assign("student.html");
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(verifyButton, false);
        }
    }

    async function resendCode() {
        if (resendButton.disabled) return;
        emailInput.value = enteredEmail;
        await requestCode();
    }

    function changeEmail() {
        challengeId = null;
        if (countdown) window.clearInterval(countdown);
        countdown = null;
        codeStep.hidden = true;
        emailStep.hidden = false;
        codeInput.value = "";
        clearMessages();
        emailInput.focus();
    }

    requestButton.dataset.idleLabel = requestButton.textContent.trim();
    verifyButton.dataset.idleLabel = verifyButton.textContent.trim();
    requestButton.addEventListener("click", requestCode);
    verifyButton.addEventListener("click", verifyCode);
    resendButton.addEventListener("click", resendCode);
    document.getElementById("changeEmail").addEventListener("click", changeEmail);
    codeInput.addEventListener("input", function () {
        codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    });

    loadUniversities();
})();
