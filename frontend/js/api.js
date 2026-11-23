(function () {
    class VioApiError extends Error {
        constructor(message, status, code, fields, requestId) {
            super(message);
            this.name = "VioApiError";
            this.status = status;
            this.code = code;
            this.fields = fields || {};
            this.requestId = requestId || null;
        }
    }

    var config = window.VIO_CONFIG || {};
    var baseUrl = (config.apiBaseUrl || "").replace(/\/+$/, "");
    var apiPrefix = (config.apiPrefix || "/api/v1").replace(/\/+$/, "");

    function unwrap(payload) {
        return payload ? payload.data : null;
    }

    async function request(path, method, body) {
        var headers = {};
        var options = {
            method: method,
            credentials: "include",
            headers: headers
        };

        if (body !== undefined) {
            headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        var response;
        try {
            response = await fetch(baseUrl + apiPrefix + path, options);
        } catch (error) {
            throw new VioApiError(
                "We could not reach VIO. Check your connection and try again.",
                0,
                "network_error"
            );
        }

        if (response.status === 204) return null;

        var payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw new VioApiError(
                "VIO returned an unreadable response. Please try again.",
                response.status,
                "invalid_response"
            );
        }

        if (!response.ok) {
            var apiError = payload && payload.error ? payload.error : {};
            throw new VioApiError(
                apiError.message || "VIO could not complete that request.",
                response.status,
                apiError.code || "request_failed",
                apiError.fields,
                apiError.request_id
            );
        }

        return payload;
    }

    window.VioApi = Object.freeze({
        get: function (path) {
            return request(path, "GET").then(unwrap);
        },
        post: function (path, body) {
            return request(path, "POST", body).then(unwrap);
        },
        put: function (path, body) {
            return request(path, "PUT", body).then(unwrap);
        },
        delete: function (path) {
            return request(path, "DELETE").then(unwrap);
        },
        Error: VioApiError
    });
})();
