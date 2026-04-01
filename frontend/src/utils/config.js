const CONFIG = {
    API_BASE_URL: "http://127.0.0.1:5000",
};

export const fetchAuth = async (url, options = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
        ...options.headers,
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        localStorage.removeItem("user");
        localStorage.removeItem("username");
        localStorage.removeItem("email");
        localStorage.removeItem("token");
        window.location.href = "/login";
        return new Promise(() => {});
    }
    return res;
};

export default CONFIG;
