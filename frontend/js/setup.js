(function () {
    var sessionStorageKey = "vioUniversityId";
    var setupError = document.getElementById("setupError");
    var setupSuccess = document.getElementById("setupSuccess");
    var content = document.getElementById("setupContent");
    var universityMissing = document.getElementById("universityMissing");
    var facultySelect = document.getElementById("faculty");
    var departmentSelect = document.getElementById("department");
    var levelSelect = document.getElementById("level");
    var coursesPanel = document.getElementById("coursesPanel");
    var coursePicker = document.getElementById("coursePicker");
    var courseListMessage = document.getElementById("courseListMessage");
    var saveProfileButton = document.getElementById("saveProfile");
    var saveCoursesButton = document.getElementById("saveCourses");
    var universityId = null;
    var university = null;
    var academicSession = null;
    var catalogue = [];
    var faculties = [];
    var currentProfile = null;
    var courseRegistrationsReady = false;

    function showError(message) {
        setupError.textContent = message;
        setupError.hidden = false;
        setupSuccess.hidden = true;
    }

    function showSuccess(message) {
        setupSuccess.textContent = message;
        setupSuccess.hidden = false;
        setupError.hidden = true;
    }

    function clearError() {
        setupError.hidden = true;
        setupError.textContent = "";
    }

    function setBusy(button, busy, idleLabel) {
        if (idleLabel) button.dataset.idleLabel = idleLabel;
        button.disabled = busy;
        button.classList.toggle("app-button-loading", busy);
        button.textContent = busy ? "Saving…" : button.dataset.idleLabel;
    }

    function updateSelect(select, placeholder, options, valueField, labelField) {
        select.replaceChildren(new Option(placeholder, ""));
        options.forEach(function (item) {
            select.add(new Option(item[labelField], item[valueField]));
        });
        select.disabled = options.length === 0;
    }

    function resetDepartmentSelect() {
        departmentSelect.replaceChildren(new Option("Choose faculty first", ""));
        departmentSelect.disabled = true;
    }

    function addCourseOption(course, selectedIds) {
        var label = document.createElement("label");
        label.className = "course-option";
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "courseIds";
        checkbox.value = course.course_id;
        checkbox.checked = selectedIds.has(course.course_id);

        var details = document.createElement("span");
        var title = document.createElement("strong");
        title.textContent = course.course_code + " · " + course.course_title;
        var note = document.createElement("small");
        note.textContent = course.semester ? "Semester " + course.semester : "Semester not stated in source";
        details.append(title, note);

        var level = document.createElement("span");
        level.className = "course-option__level";
        level.textContent = course.level + " level";
        label.append(checkbox, details, level);
        coursePicker.appendChild(label);
    }

    function renderCourses(selectedIds) {
        var departmentId = departmentSelect.value;
        var level = Number(levelSelect.value);
        var unique = new Map();
        catalogue.forEach(function (row) {
            if (row.department_id !== departmentId || Number(row.level) !== level) return;
            if (!unique.has(row.course_id)) unique.set(row.course_id, row);
        });

        coursePicker.replaceChildren();
        var courses = Array.from(unique.values()).sort(function (a, b) {
            return a.course_code.localeCompare(b.course_code);
        });

        if (courses.length === 0) {
            courseListMessage.textContent = "No catalogue rows are available for this department and level. VIO will not invent course options.";
            return;
        }

        courseListMessage.textContent =
            courses.length + " catalogue options. Selections remain self-declared and unverified.";
        courses.forEach(function (course) {
            addCourseOption(course, selectedIds || new Set());
        });
    }

    async function loadDepartments(facultyId, preferredDepartmentId) {
        resetDepartmentSelect();
        if (!facultyId) return;
        var departments = await window.VioApi.get("/faculties/" + encodeURIComponent(facultyId) + "/departments");
        updateSelect(departmentSelect, "Choose your department", departments, "id", "name");
        if (preferredDepartmentId) departmentSelect.value = preferredDepartmentId;
        if (departmentSelect.value) renderCourses(new Set());
    }

    async function loadInitialData() {
        var session;
        try {
            session = await window.VioApi.get("/auth/session");
        } catch (error) {
            if (error.status === 401) {
                window.location.replace("sign-in.html");
                return;
            }
            showError(error.message);
            return;
        }

        try {
            universityId = sessionStorage.getItem(sessionStorageKey);
        } catch (error) {
            showError("Your browser session storage is unavailable. Enable it and sign in again to continue setup.");
            return;
        }

        if (!universityId) {
            content.hidden = true;
            universityMissing.hidden = false;
            return;
        }

        try {
            var results = await Promise.all([
                window.VioApi.get("/universities"),
                window.VioApi.get("/academic-sessions")
            ]);
            university = results[0].find(function (item) {
                return item.id === universityId;
            });
            if (!university) {
                showError("The selected university is no longer available. Please sign in again.");
                return;
            }

            var sessions = results[1].filter(function (item) {
                return item.university === university.short_name;
            });
            academicSession = sessions[0] || null;
            if (!academicSession) {
                showError("The academic session calendar is not available for this university yet.");
                return;
            }

            document.getElementById("universityName").textContent = university.name;
            var status = academicSession.status === "confirmed" ? "Confirmed calendar" : "Proposed calendar";
            document.getElementById("sessionStatus").textContent = academicSession.session + " · " + status;
            document.getElementById("sessionStatus").className = academicSession.status === "confirmed"
                ? "app-status app-status--teal"
                : "app-status app-status--gold";
            var calendarNotice = document.getElementById("calendarNotice");
            calendarNotice.textContent = academicSession.status === "proposed"
                ? "This academic calendar is proposed, not final. Dates may change. Source: " + academicSession.source
                : "Academic session source: " + academicSession.source;
            calendarNotice.hidden = false;

            var facultyData = await window.VioApi.get(
                "/universities/" + encodeURIComponent(university.short_name) + "/faculties"
            );
            faculties = facultyData;
            updateSelect(facultySelect, "Choose your faculty", faculties, "id", "name");

            catalogue = await window.VioApi.get(
                "/universities/" + encodeURIComponent(university.short_name) + "/catalogue"
            );
            currentProfile = await window.VioApi.get("/student/profile");
            content.hidden = false;

            if (currentProfile.department_id) {
                var matchingRow = catalogue.find(function (row) {
                    return row.department_id === currentProfile.department_id;
                });
                if (matchingRow) {
                    var matchingFaculty = faculties.find(function (item) {
                        return item.name === matchingRow.faculty;
                    });
                    if (matchingFaculty) {
                        facultySelect.value = matchingFaculty.id;
                        await loadDepartments(matchingFaculty.id, currentProfile.department_id);
                    }
                }
                if (currentProfile.level) levelSelect.value = String(currentProfile.level);
            }

            var savedCoursesLoaded = false;
            if (session.setup_state === "ready") savedCoursesLoaded = await loadSavedCourses();

            if (session.setup_state === "ready" && currentProfile.department_id) {
                coursesPanel.hidden = false;
                document.getElementById("profileHint").textContent =
                    "Your profile and academic session are set. Update them here if needed.";
                if (!savedCoursesLoaded) renderCourses(new Set());
            }
        } catch (error) {
            showError(error.message);
        }
    }

    async function loadSavedCourses() {
        try {
            var existing = await window.VioApi.get(
                "/student/courses?academic_session=" + encodeURIComponent(academicSession.session)
            );
            courseRegistrationsReady = true;
            var selected = new Set(existing.map(function (item) {
                return item.course_id;
            }));
            renderCourses(selected);
            coursesPanel.hidden = false;
            saveCoursesButton.disabled = false;
            return true;
        } catch (error) {
            courseRegistrationsReady = false;
            saveCoursesButton.disabled = true;
            if (error.status !== 422) showError(error.message);
            return false;
        }
    }

    async function saveProfile() {
        clearError();
        var invalidField = document.querySelector("#profileForm :invalid");
        if (invalidField) {
            invalidField.reportValidity();
            return;
        }

        setBusy(saveProfileButton, true, "Save profile & confirm session");
        try {
            await window.VioApi.put("/student/profile", {
                department_id: departmentSelect.value,
                level: Number(levelSelect.value)
            });
            await window.VioApi.post("/student/profile/confirm-session", {
                academic_session: academicSession.session
            });
            currentProfile = await window.VioApi.get("/student/profile");
            var savedCoursesLoaded = await loadSavedCourses();
            coursesPanel.hidden = false;
            document.getElementById("profileHint").textContent =
                "Profile saved. Choose the courses you are registered for this session.";
            if (savedCoursesLoaded) {
                showSuccess("Profile saved and academic session confirmed.");
            } else {
                showError("Profile and session were saved, but VIO could not load existing course selections. Try again before saving courses.");
            }
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(saveProfileButton, false);
        }
    }

    async function saveCourses() {
        clearError();
        if (!courseRegistrationsReady) {
            showError("Confirm your profile and academic session before saving course selections.");
            return;
        }
        var courseIds = Array.from(coursePicker.querySelectorAll("input[name='courseIds']:checked"))
            .map(function (input) { return input.value; });
        setBusy(saveCoursesButton, true, "Save course selections");
        try {
            await window.VioApi.put("/student/courses", {
                academic_session: academicSession.session,
                course_ids: courseIds
            });
            showSuccess("Course selections saved. They are self-declared and remain unverified.");
            window.setTimeout(function () {
                window.location.assign("student.html");
            }, 900);
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(saveCoursesButton, false);
        }
    }

    facultySelect.addEventListener("change", function () {
        clearError();
        courseRegistrationsReady = false;
        saveCoursesButton.disabled = true;
        loadDepartments(facultySelect.value).catch(function (error) {
            showError(error.message);
        });
    });

    departmentSelect.addEventListener("change", function () {
        courseRegistrationsReady = false;
        saveCoursesButton.disabled = true;
        renderCourses(new Set());
    });

    levelSelect.addEventListener("change", function () {
        if (departmentSelect.value) {
            courseRegistrationsReady = false;
            saveCoursesButton.disabled = true;
            renderCourses(new Set());
        }
    });

    saveProfileButton.dataset.idleLabel = saveProfileButton.textContent.trim();
    saveCoursesButton.dataset.idleLabel = saveCoursesButton.textContent.trim();
    saveCoursesButton.disabled = true;
    saveProfileButton.addEventListener("click", saveProfile);
    saveCoursesButton.addEventListener("click", saveCourses);
    loadInitialData();
})();
