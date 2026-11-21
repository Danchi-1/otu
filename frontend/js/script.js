
console.log("VIO is running!");

const reportForm = document.getElementById("reportForm");
const formMessage = document.getElementById("formMessage");
const reportList = document.getElementById("reportList");

const totalDisplay = document.getElementById("totalReports");
const pendingDisplay = document.getElementById("pendingReports");
const reviewedDisplay = document.getElementById("reviewedReports");

localStorage.removeItem("vioReports");

let reports = [];

// Reusable API function for future backend integration
async function vioApi(endpoint, options = {}) {
    const base = window.VIO_CONFIG.API_BASE_URL;
    const prefix = window.VIO_CONFIG.API_PREFIX;

    if (!base) {
        throw new Error("Backend URL has not been configured.");
    }

    const response = await fetch(`${base}${prefix}${endpoint}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Request failed");
    }

    return result;
}

function updateDashboard() {
    totalDisplay.textContent = reports.length;
    pendingDisplay.textContent = reports.length;
    reviewedDisplay.textContent = 0;
}

function displayReports() {
    reportList.innerHTML = "";

    if (reports.length === 0) {
        reportList.textContent = "No reports submitted yet.";
        return;
    }

    reports.forEach(function(report) {
        const item = document.createElement("article");
        item.className = "report-item";

        const heading = document.createElement("h3");
        heading.textContent = report.category;

        const course = document.createElement("p");
        course.textContent = "Course: " + (report.course || "Not specified");

        const date = document.createElement("p");
        date.textContent = "Incident date: " + report.date;

        const description = document.createElement("p");
        description.textContent = report.description;

        const status = document.createElement("small");
        status.className = "review-status";
        status.textContent = "Pending Review";

        item.append(heading, course, date, description, status);
        reportList.appendChild(item);
    });
}

updateDashboard();
displayReports();

reportForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const category = document.getElementById("category").value;
    const course = document.getElementById("course").value.trim();
    const date = document.getElementById("incidentDate").value;
    const description = document.getElementById("description").value.trim();

    if (description.length < 20) {
        formMessage.textContent = "Please provide at least 20 characters.";
        return;
    }

    const newReport = {
        category: category,
        course: course,
        date: date,
        description: description,
        submittedAt: new Date().toISOString()
    };

    reports.unshift(newReport);

    try {
        localStorage.setItem("vioReports", JSON.stringify(reports));
    } catch (error) {
        formMessage.textContent = "Unable to save this demo report in your browser.";
        reports.shift();
        return;
    }

    updateDashboard();
    displayReports();

    formMessage.textContent =
        "Your report has been received for this demonstration!";

    reportForm.reset();
});
