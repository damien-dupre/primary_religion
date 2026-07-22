/* Extensions for the exported VisQuill viewer. The lens engine remains native. */
(function () {
    "use strict";

    const VISQUILL_LAYER_ID = "vq-data-points-layer";
    const SOURCE_ID = "school-ethos-points";
    const LAYER_ID = "school-ethos-points-layer";
    const ETHOS = [
        "Catholic",
        "Church of Ireland",
        "Multi-denominational",
        "Inter-denominational",
        "Other",
    ];
    const ETHOS_COLORS = {
        "Catholic": "#8f3fb0",
        "Church of Ireland": "#e07a3f",
        "Multi-denominational": "#2a7fa3",
        "Inter-denominational": "#58a58e",
        "Other": "#d1a72b",
    };
    const PARENT_COLORS = {
        denom: "#343a40",
        multi: "#ff4f9a",
    };

    let initialized = false;
    let activePopup = null;

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;",
        })[character]);
    }

    function validPercentage(value) {
        return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
    }

    function waitForLayer(map, timeout = 6000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const check = () => {
                if (map.getLayer(VISQUILL_LAYER_ID)) {
                    resolve();
                    return;
                }
                if (Date.now() - started > timeout) {
                    reject(new Error("The VisQuill school layer did not become available"));
                    return;
                }
                window.setTimeout(check, 60);
            };
            check();
        });
    }

    function addPointPresentation(map) {
        if (!map.getLayer(LAYER_ID)) return;
        map.setPaintProperty(LAYER_ID, "circle-color", [
            "match",
            ["get", "ethos"],
            "Catholic", ETHOS_COLORS.Catholic,
            "Church of Ireland", ETHOS_COLORS["Church of Ireland"],
            "Multi-denominational", ETHOS_COLORS["Multi-denominational"],
            "Inter-denominational", ETHOS_COLORS["Inter-denominational"],
            "Other", ETHOS_COLORS.Other,
            "#777777",
        ]);
        map.setPaintProperty(LAYER_ID, "circle-stroke-color", "rgba(255,255,255,0.92)");
        map.setPaintProperty(LAYER_ID, "circle-stroke-width", 0.8);
        map.setPaintProperty(LAYER_ID, "circle-opacity", 0.9);
    }

    function applySchoolPoints(map, points) {
        const data = {
            type: "FeatureCollection",
            features: points.map((school) => ({
                type: "Feature",
                id: String(school.id),
                geometry: {
                    type: "Point",
                    coordinates: [Number(school.lng), Number(school.lat)],
                },
                properties: {
                    id: String(school.id),
                    name: school.name || "School",
                    county: school.county || "",
                    ethos: school.ethos || "Other",
                    denomPct: validPercentage(school.denomPct) ? Number(school.denomPct) : null,
                    multiPct: validPercentage(school.multiPct) ? Number(school.multiPct) : null,
                },
            })),
        };

        const source = map.getSource(SOURCE_ID);
        if (source) {
            source.setData(data);
        } else {
            map.addSource(SOURCE_ID, { type: "geojson", data });
        }

        const baseRadius = map.getLayer(VISQUILL_LAYER_ID)
            ? map.getPaintProperty(VISQUILL_LAYER_ID, "circle-radius")
            : 4;
        if (!map.getLayer(LAYER_ID)) {
            map.addLayer({
                id: LAYER_ID,
                type: "circle",
                source: SOURCE_ID,
                paint: {
                    "circle-radius": baseRadius || 4,
                    "circle-color": "#777777",
                },
            });
        } else if (baseRadius) {
            map.setPaintProperty(LAYER_ID, "circle-radius", baseRadius);
        }

        if (map.getLayer(VISQUILL_LAYER_ID)) {
            map.setPaintProperty(VISQUILL_LAYER_ID, "circle-opacity", 0);
            map.setPaintProperty(VISQUILL_LAYER_ID, "circle-stroke-opacity", 0);
        }
        addPointPresentation(map);
        return true;
    }

    function createFilterUi(app, totals) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "school-filter-toggle";
        toggle.setAttribute("aria-controls", "school-filter-panel");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "School filters";

        const panel = document.createElement("aside");
        panel.id = "school-filter-panel";
        panel.className = "school-filter-panel";
        panel.setAttribute("aria-label", "Filter schools and lens calculations");
        panel.innerHTML = `
            <div class="school-filter-header">
                <div>
                    <h2>Filter schools</h2>
                    <p>Filters update the school dots and both VisQuill lenses.</p>
                </div>
                <button class="school-filter-close" type="button" aria-label="Close filters">×</button>
            </div>

            <section class="school-filter-section">
                <div class="school-filter-section-title">
                    <span>School ethos</span>
                    <button class="school-filter-link" id="select-all-ethos" type="button">Select all</button>
                </div>
                <div class="ethos-filter-list">
                    ${ETHOS.map((ethos) => `
                        <label class="ethos-filter-option">
                            <input type="checkbox" data-ethos="${escapeHtml(ethos)}" checked>
                            <span class="school-color-dot" style="background:${ETHOS_COLORS[ethos]}"></span>
                            <span>${escapeHtml(ethos)}</span>
                            <span class="ethos-filter-total">${(totals[ethos] || 0).toLocaleString()}</span>
                        </label>
                    `).join("")}
                </div>
            </section>

            <section class="school-filter-section">
                <div class="school-filter-section-title">What parents prefer here</div>
                <select class="preference-select" id="preference-field" aria-label="Parent preference to filter by">
                    <option value="any">Any preference</option>
                    <option value="denom">Denominational</option>
                    <option value="multi">Multi-denominational</option>
                </select>
                <div class="preference-threshold is-disabled" id="preference-threshold-wrap">
                    <label for="preference-threshold">Minimum preference</label>
                    <output id="preference-threshold-value" for="preference-threshold">50%</output>
                    <input id="preference-threshold" type="range" min="0" max="100" step="1" value="50" disabled>
                </div>
                <div class="parent-color-key" aria-label="Parent preference lens colours">
                    <span><i class="parent-color-dot" style="background:${PARENT_COLORS.denom}"></i>Denominational</span>
                    <span><i class="parent-color-dot" style="background:${PARENT_COLORS.multi}"></i>Multi-denom.</span>
                </div>
            </section>

            <div class="school-filter-footer">
                <div class="school-filter-count" id="school-filter-count">
                    <strong>—</strong>
                    schools shown
                </div>
                <button class="school-filter-reset" id="school-filter-reset" type="button">Reset filters</button>
            </div>
        `;

        app.append(toggle, panel);

        const setOpen = (open) => {
            panel.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", String(open));
        };
        toggle.addEventListener("click", () => setOpen(!panel.classList.contains("is-open")));
        panel.querySelector(".school-filter-close").addEventListener("click", () => setOpen(false));
        if (window.matchMedia("(min-width: 900px)").matches) setOpen(true);

        for (const eventName of ["pointerdown", "dblclick", "wheel"]) {
            panel.addEventListener(eventName, (event) => event.stopPropagation(), { passive: eventName === "wheel" });
            toggle.addEventListener(eventName, (event) => event.stopPropagation(), { passive: eventName === "wheel" });
        }

        return { toggle, panel, setOpen };
    }

    function closePopup() {
        if (!activePopup) return;
        activePopup.element.remove();
        activePopup = null;
    }

    function positionPopup(map, app) {
        if (!activePopup) return;
        const point = map.project(activePopup.coordinates);
        const width = activePopup.element.offsetWidth || 290;
        const height = activePopup.element.offsetHeight || 190;
        const x = Math.max(width / 2 + 8, Math.min(app.clientWidth - width / 2 - 8, point.x));
        const y = Math.max(height + 22, Math.min(app.clientHeight - 10, point.y));
        activePopup.element.style.left = `${x}px`;
        activePopup.element.style.top = `${y}px`;
    }

    function preferenceRow(label, value, color) {
        return `
            <div class="school-popup-pref-row">
                <span>${escapeHtml(label)}</span>
                <span class="school-popup-pref-track">
                    <span class="school-popup-pref-fill" style="width:${value}%;background:${color}"></span>
                </span>
                <span class="school-popup-pref-value">${Math.round(value)}%</span>
            </div>
        `;
    }

    function openPopup(map, app, school, coordinates) {
        closePopup();
        const element = document.createElement("article");
        element.className = "school-popup";
        element.setAttribute("role", "dialog");
        element.setAttribute("aria-label", school.name);

        const hasPreference = validPercentage(school.denomPct) && validPercentage(school.multiPct);
        const preference = hasPreference
            ? `${preferenceRow("Denominational", Number(school.denomPct), PARENT_COLORS.denom)}
               ${preferenceRow("Multi-denominational", Number(school.multiPct), PARENT_COLORS.multi)}`
            : '<div class="school-popup-no-data">No parental-preference survey data is available for this school area.</div>';

        element.innerHTML = `
            <button class="school-popup-close" type="button" aria-label="Close school details">×</button>
            <h3>${escapeHtml(school.name)}</h3>
            <p class="school-popup-county">${escapeHtml(school.county || "Ireland")}</p>
            <div class="school-popup-ethos">
                <span class="school-color-dot" style="background:${ETHOS_COLORS[school.ethos] || "#777"}"></span>
                ${escapeHtml(school.ethos)}
            </div>
            <div class="school-popup-heading">What parents here prefer</div>
            ${preference}
        `;
        element.querySelector(".school-popup-close").addEventListener("click", closePopup);
        element.addEventListener("pointerdown", (event) => event.stopPropagation());
        app.appendChild(element);
        activePopup = { element, coordinates };
        positionPopup(map, app);
        element.querySelector(".school-popup-close").focus({ preventScroll: true });
    }

    function featuresAtPoint(map, point) {
        const padding = 10;
        return map.queryRenderedFeatures([
            [point.x - padding, point.y - padding],
            [point.x + padding, point.y + padding],
        ], { layers: [LAYER_ID] });
    }

    function installMapInteractions(map, app, detailsById, getVisiblePoints) {
        const nearestSchoolAt = (point) => {
            let nearest = null;
            let nearestDistanceSquared = 18 * 18;
            for (const school of getVisiblePoints()) {
                const projected = map.project([Number(school.lng), Number(school.lat)]);
                const dx = projected.x - point.x;
                const dy = projected.y - point.y;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared <= nearestDistanceSquared) {
                    nearest = school;
                    nearestDistanceSquared = distanceSquared;
                }
            }
            return nearest;
        };

        const schoolAtPoint = (point) => {
            const features = featuresAtPoint(map, point);
            if (features.length) {
                const feature = features[0];
                const school = detailsById.get(String(feature.properties.id));
                return school ? { school, coordinates: feature.geometry.coordinates } : null;
            }

            const nearest = nearestSchoolAt(point);
            if (!nearest) return null;
            return {
                school: detailsById.get(String(nearest.id)) || nearest,
                coordinates: [Number(nearest.lng), Number(nearest.lat)],
            };
        };

        const selectSchoolAt = (point) => {
            const selection = schoolAtPoint(point);
            if (!selection) {
                closePopup();
                return;
            }
            openPopup(map, app, selection.school, selection.coordinates);
        };

        const isUiTarget = (target) => target instanceof Element &&
            Boolean(target.closest(".school-popup, .school-filter-panel, .school-filter-toggle"));
        const pointFromEvent = (event) => {
            const canvasRect = map.getCanvas().getBoundingClientRect();
            if (
                event.clientX < canvasRect.left || event.clientX > canvasRect.right ||
                event.clientY < canvasRect.top || event.clientY > canvasRect.bottom
            ) return null;
            return {
                x: event.clientX - canvasRect.left,
                y: event.clientY - canvasRect.top,
            };
        };

        let activePress = null;
        let hoverPoint = null;
        let hoverFrame = 0;
        const clearActivePress = () => {
            activePress = null;
            app.classList.remove("school-point-hover");
        };

        // Record the gesture without opening anything. VisQuill remains free to
        // drag the lens normally; a popup is created only after a stationary release.
        window.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            if (isUiTarget(event.target)) return;
            const point = pointFromEvent(event);
            if (!point) return;
            app.classList.remove("school-point-hover");
            activePress = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
            };
        }, true);

        window.addEventListener("pointermove", (event) => {
            if (activePress && event.pointerId === activePress.pointerId) {
                const distance = Math.hypot(
                    event.clientX - activePress.startX,
                    event.clientY - activePress.startY
                );
                if (distance > 6) activePress.moved = true;
                if (activePress.moved) app.classList.remove("school-point-hover");
                return;
            }

            hoverPoint = isUiTarget(event.target) ? null : pointFromEvent(event);
            if (hoverFrame) return;
            hoverFrame = window.requestAnimationFrame(() => {
                hoverFrame = 0;
                app.classList.toggle("school-point-hover", Boolean(hoverPoint && schoolAtPoint(hoverPoint)));
            });
        }, true);

        window.addEventListener("pointerup", (event) => {
            if (!activePress || event.pointerId !== activePress.pointerId) return;
            const distance = Math.hypot(
                event.clientX - activePress.startX,
                event.clientY - activePress.startY
            );
            const wasDrag = activePress.moved || distance > 6;
            activePress = null;
            if (wasDrag) {
                app.classList.remove("school-point-hover");
                return;
            }
            const point = pointFromEvent(event);
            if (point) selectSchoolAt(point);
        }, true);

        window.addEventListener("pointercancel", clearActivePress, true);
        map.on("move", () => {
            app.classList.remove("school-point-hover");
            positionPopup(map, app);
        });
        map.on("zoom", () => {
            app.classList.remove("school-point-hover");
            positionPopup(map, app);
        });
    }

    async function init() {
        if (initialized || !window.__visquillMap || !window.__visquillController || !window.__visquillPayload) return;
        initialized = true;

        const app = document.getElementById("app");
        const map = window.__visquillMap;
        const controller = window.__visquillController;
        const payload = window.__visquillPayload;
        let details = window.__VQ_DETAILS;
        if (!Array.isArray(details)) {
            const response = await fetch("./school-details.json");
            if (!response.ok) throw new Error(`Failed to load school-details.json: ${response.status}`);
            details = await response.json();
        }
        const detailsById = new Map(details.map((school) => [String(school.id), school]));

        const basePoints = payload.points.map((point) => {
            const school = detailsById.get(String(point.id));
            return school ? Object.assign(point, school) : point;
        });
        const totals = Object.fromEntries(ETHOS.map((ethos) => [ethos, 0]));
        for (const point of basePoints) totals[point.ethos] = (totals[point.ethos] || 0) + 1;

        const { panel } = createFilterUi(app, totals);
        const ethosInputs = [...panel.querySelectorAll("[data-ethos]")];
        const preferenceField = panel.querySelector("#preference-field");
        const thresholdInput = panel.querySelector("#preference-threshold");
        const thresholdWrap = panel.querySelector("#preference-threshold-wrap");
        const thresholdValue = panel.querySelector("#preference-threshold-value");
        const countElement = panel.querySelector("#school-filter-count strong");
        let renderVersion = 0;
        let visiblePoints = basePoints;

        const refresh = () => {
            const selectedEthos = new Set(
                ethosInputs.filter((input) => input.checked).map((input) => input.dataset.ethos)
            );
            const preference = preferenceField.value;
            const threshold = Number(thresholdInput.value);
            const filteredPoints = basePoints.filter((point) => {
                if (!selectedEthos.has(point.ethos)) return false;
                if (preference === "any") return true;
                const value = preference === "denom" ? point.denomPct : point.multiPct;
                return validPercentage(value) && Number(value) >= threshold;
            });
            visiblePoints = filteredPoints;

            const version = ++renderVersion;
            const syncRenderedPoints = () => {
                window.setTimeout(() => {
                    waitForLayer(map).then(() => {
                        if (version !== renderVersion) return;
                        applySchoolPoints(map, filteredPoints);
                    }).catch((error) => console.error("Could not refresh school points:", error));
                }, 0);
            };

            // VisQuill replaces the MapLibre style during every controller update.
            // Register first, then restore the full school properties after its own
            // styledata handler has recreated the point source and layer.
            map.once("styledata", syncRenderedPoints);
            controller.update({
                points: filteredPoints,
                groups: payload.groups,
                config: payload.config,
            });
            countElement.textContent = `${filteredPoints.length.toLocaleString()} of ${basePoints.length.toLocaleString()}`;
            closePopup();
            window.setTimeout(syncRenderedPoints, 300);
        };

        for (const input of ethosInputs) input.addEventListener("change", refresh);
        panel.querySelector("#select-all-ethos").addEventListener("click", () => {
            ethosInputs.forEach((input) => { input.checked = true; });
            refresh();
        });
        preferenceField.addEventListener("change", () => {
            const disabled = preferenceField.value === "any";
            thresholdInput.disabled = disabled;
            thresholdWrap.classList.toggle("is-disabled", disabled);
            refresh();
        });
        thresholdInput.addEventListener("input", () => {
            thresholdValue.textContent = `${thresholdInput.value}%`;
            refresh();
        });
        panel.querySelector("#school-filter-reset").addEventListener("click", () => {
            ethosInputs.forEach((input) => { input.checked = true; });
            preferenceField.value = "any";
            thresholdInput.value = "50";
            thresholdInput.disabled = true;
            thresholdValue.textContent = "50%";
            thresholdWrap.classList.add("is-disabled");
            refresh();
        });

        await waitForLayer(map);
        installMapInteractions(map, app, detailsById, () => visiblePoints);
        refresh();
    }

    function start() {
        init().catch((error) => {
            console.error("School-map enhancements failed:", error);
            const app = document.getElementById("app");
            if (!app) return;
            const message = document.createElement("div");
            message.style.cssText = "position:absolute;right:16px;bottom:16px;z-index:1400;padding:10px 12px;border-radius:9px;background:#fff;color:#a22;font:12px system-ui;box-shadow:0 5px 18px #0002";
            message.textContent = "School filters could not be loaded.";
            app.appendChild(message);
        });
    }

    window.addEventListener("visquill-ready", start, { once: true });
    if (window.__visquillController) queueMicrotask(start);
})();
