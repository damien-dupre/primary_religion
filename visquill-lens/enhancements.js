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
    const SCHOOL_TYPES = ["Single-sex", "Coeducational"];
    const SCHOOL_TYPE_COLORS = {
        "Single-sex": "#c43d32",
        "Coeducational": "#5966b3",
    };
    const LANGUAGES = ["English", "Irish"];
    const LANGUAGE_COLORS = {
        "English": "#00796b",
        "Irish": "#f2a900",
    };
    const PARENT_COLORS = {
        english: LANGUAGE_COLORS.English,
        irish: LANGUAGE_COLORS.Irish,
        denom: "#343a40",
        multi: "#ff4f9a",
        singleSex: SCHOOL_TYPE_COLORS["Single-sex"],
        coed: SCHOOL_TYPE_COLORS.Coeducational,
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

    function addPointPresentation(map, colourMode = "ethos") {
        if (!map.getLayer(LAYER_ID)) return;
        let colourExpression;
        if (colourMode === "schoolType") {
            colourExpression = [
                "match",
                ["get", "schoolGender"],
                "Single-sex", SCHOOL_TYPE_COLORS["Single-sex"],
                "Coeducational", SCHOOL_TYPE_COLORS.Coeducational,
                "#777777",
            ];
        } else if (colourMode === "language") {
            colourExpression = [
                "match",
                ["get", "instructionLanguage"],
                "English", LANGUAGE_COLORS.English,
                "Irish", LANGUAGE_COLORS.Irish,
                "#777777",
            ];
        } else {
            colourExpression = [
                "match",
                ["get", "ethos"],
                "Catholic", ETHOS_COLORS.Catholic,
                "Church of Ireland", ETHOS_COLORS["Church of Ireland"],
                "Multi-denominational", ETHOS_COLORS["Multi-denominational"],
                "Inter-denominational", ETHOS_COLORS["Inter-denominational"],
                "Other", ETHOS_COLORS.Other,
                "#777777",
            ];
        }
        map.setPaintProperty(LAYER_ID, "circle-color", colourExpression);
        map.setPaintProperty(LAYER_ID, "circle-stroke-color", "rgba(255,255,255,0.92)");
        map.setPaintProperty(LAYER_ID, "circle-stroke-width", 0.8);
        map.setPaintProperty(LAYER_ID, "circle-opacity", 0.9);
    }

    function applySchoolPoints(map, points, colourMode = "ethos") {
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
                    schoolGender: school.schoolGender || "Unknown",
                    instructionLanguage: school.instructionLanguage || "Unknown",
                    participationPct: validPercentage(school.participationPct) ? Number(school.participationPct) : null,
                    englishPct: validPercentage(school.englishPct) ? Number(school.englishPct) : null,
                    irishPct: validPercentage(school.irishPct) ? Number(school.irishPct) : null,
                    denomPct: validPercentage(school.denomPct) ? Number(school.denomPct) : null,
                    multiPct: validPercentage(school.multiPct) ? Number(school.multiPct) : null,
                    singleSexPct: validPercentage(school.singleSexPct) ? Number(school.singleSexPct) : null,
                    coedPct: validPercentage(school.coedPct) ? Number(school.coedPct) : null,
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
        addPointPresentation(map, colourMode);
        return true;
    }

    function createFilterUi(app, totals, schoolTypeTotals, languageTotals) {
        const controls = document.createElement("div");
        controls.className = "school-panel-controls";

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "school-filter-toggle";
        toggle.setAttribute("aria-controls", "school-filter-panel");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = '<span class="school-toggle-label">School filters</span>';

        const panel = document.createElement("aside");
        panel.id = "school-filter-panel";
        panel.className = "school-filter-panel";
        panel.setAttribute("aria-label", "Filter schools and lens calculations");
        panel.innerHTML = `
            <div class="school-filter-header">
                <div>
                    <h2>Filter schools</h2>
                    <p>Filters update the school dots and all three VisQuill lenses.</p>
                </div>
                <button class="school-filter-close" type="button" aria-label="Close filters">×</button>
            </div>

            <section class="school-filter-section">
                <div class="school-filter-section-title">Colour school dots by</div>
                <div class="point-colour-switch" role="radiogroup" aria-label="Colour school dots by">
                    <label>
                        <input type="radio" name="point-colour-mode" value="ethos" checked>
                        <span>Ethos</span>
                    </label>
                    <label>
                        <input type="radio" name="point-colour-mode" value="schoolType">
                        <span>School type</span>
                    </label>
                    <label>
                        <input type="radio" name="point-colour-mode" value="language">
                        <span>Language</span>
                    </label>
                </div>
            </section>

            <section class="school-filter-section parent-preference-filter">
                <div class="school-filter-section-title">Parent Preference</div>
                <select class="preference-select" id="preference-field" aria-label="Parent preference to filter by">
                    <option value="any">Any preference</option>
                    <optgroup label="Language">
                        <option value="english">English</option>
                        <option value="irish">Irish</option>
                    </optgroup>
                    <optgroup label="School Ethos">
                        <option value="denom">Denominational</option>
                        <option value="multi">Multi-denominational</option>
                    </optgroup>
                    <optgroup label="School Type">
                        <option value="singleSex">Single-sex</option>
                        <option value="coed">Coeducational</option>
                    </optgroup>
                </select>
                <div class="preference-threshold is-disabled" id="preference-threshold-wrap">
                    <label for="preference-threshold">Minimum preference</label>
                    <output id="preference-threshold-value" for="preference-threshold">50%</output>
                    <input id="preference-threshold" type="range" min="0" max="100" step="1" value="50" disabled>
                </div>
            </section>

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
                <div class="school-filter-section-title">
                    <span>School type</span>
                    <button class="school-filter-link" id="select-all-school-types" type="button">Select all</button>
                </div>
                <div class="ethos-filter-list">
                    ${SCHOOL_TYPES.map((schoolType) => `
                        <label class="ethos-filter-option">
                            <input type="checkbox" data-school-type="${escapeHtml(schoolType)}" checked>
                            <span class="school-color-dot" style="background:${SCHOOL_TYPE_COLORS[schoolType]}"></span>
                            <span>${escapeHtml(schoolType)}</span>
                            <span class="ethos-filter-total">${(schoolTypeTotals[schoolType] || 0).toLocaleString()}</span>
                        </label>
                    `).join("")}
                </div>
            </section>

            <section class="school-filter-section">
                <div class="school-filter-section-title">
                    <span>School language</span>
                    <button class="school-filter-link" id="select-all-languages" type="button">Select all</button>
                </div>
                <div class="ethos-filter-list">
                    ${LANGUAGES.map((language) => `
                        <label class="ethos-filter-option">
                            <input type="checkbox" data-language="${escapeHtml(language)}" checked>
                            <span class="school-color-dot" style="background:${LANGUAGE_COLORS[language]}"></span>
                            <span>${escapeHtml(language)}</span>
                            <span class="ethos-filter-total">${(languageTotals[language] || 0).toLocaleString()}</span>
                        </label>
                    `).join("")}
                </div>
            </section>

            <div class="school-filter-footer">
                <div class="school-filter-count" id="school-filter-count">
                    <strong>0</strong>
                    schools shown
                </div>
                <button class="school-filter-reset" id="school-filter-reset" type="button">Reset filters</button>
            </div>
        `;

        controls.append(toggle);
        app.append(controls, panel);

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

        return { toggle, panel, setOpen, controls };
    }

    function createInfoUi(app, controls, closeFilters) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "school-filter-toggle project-info-toggle";
        toggle.setAttribute("aria-controls", "project-info-panel");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = '<span class="school-toggle-label">About &amp; sources</span>';

        const panel = document.createElement("aside");
        panel.id = "project-info-panel";
        panel.className = "school-filter-panel project-info-panel";
        panel.setAttribute("aria-label", "About this visualisation and its data sources");
        panel.innerHTML = `
            <div class="school-filter-header">
                <div>
                    <p class="project-info-kicker">About this map</p>
                    <h2>Primary School Lens Ireland</h2>
                    <p>Preferred language, preferred ethos and preferred school type, explored through three interactive lenses.</p>
                </div>
                <button class="school-filter-close" type="button" aria-label="Close about and sources">×</button>
            </div>

            <section class="project-profile">
                <a class="project-profile-link" href="https://www.linkedin.com/in/damien-dupre" target="_blank" rel="noopener noreferrer">
                    <span class="project-profile-photo" aria-hidden="true">
                        <span>DD</span>
                        <img src="https://www.dcu.ie/sites/default/files/dcu_business_school_editor/2025-01/professional_picture.jpeg" alt="" loading="lazy" referrerpolicy="no-referrer">
                    </span>
                    <span class="project-profile-copy">
                        <strong>Damien Dupré</strong>
                        <span>Associate Professor · DCU Business School</span>
                        <small>View LinkedIn profile ↗</small>
                    </span>
                </a>
                <p>I teach business analytics, data visualisation and quantitative research methods, with research spanning applied data science and behavioural research.</p>
            </section>

            <section class="project-info-section">
                <h3>Data sources</h3>
                <div class="project-link-list">
                    <a href="https://assets.gov.ie/static/documents/8e1b86ab/Data_on_Individual_Schools_Primary_Mainstream.xlsx" target="_blank" rel="noopener noreferrer">
                        <span class="project-link-type">XLSX</span>
                        <span><strong>Individual primary schools</strong><small>Primary mainstream school data</small></span>
                        <i aria-hidden="true">↗</i>
                    </a>
                    <a href="https://assets.gov.ie/static/documents/360dd2e5/Primary_School_Results_For_All_Primary_Schools..xls" target="_blank" rel="noopener noreferrer">
                        <span class="project-link-type">XLS</span>
                        <span><strong>Parent survey results</strong><small>Results for all primary schools</small></span>
                        <i aria-hidden="true">↗</i>
                    </a>
                </div>
            </section>

            <section class="project-info-section">
                <h3>Project &amp; credits</h3>
                <p>Built with the awesome <a href="https://visquill.com/visquill" target="_blank" rel="noopener noreferrer">VisQuill reactive geometry project ↗</a>.</p>
                <p><a href="https://github.com/damien-dupre/primary_religion" target="_blank" rel="noopener noreferrer">View the source repository on GitHub ↗</a></p>
            </section>

            <p class="project-disclosure"><strong>Vibe-coding disclosure:</strong> Created with OpenAI GPT‑5.6 Sol, starting from a <a href="https://visquill.com/visuals/lens/" target="_blank" rel="noopener noreferrer">VisQuill Lens export ↗</a>.</p>
        `;

        controls.append(toggle);
        app.append(panel);

        const setOpen = (open) => {
            panel.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", String(open));
        };
        toggle.addEventListener("click", () => {
            const open = !panel.classList.contains("is-open");
            if (open) closeFilters();
            setOpen(open);
        });
        panel.querySelector(".school-filter-close").addEventListener("click", () => setOpen(false));
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") setOpen(false);
        });

        for (const eventName of ["pointerdown", "dblclick", "wheel"]) {
            panel.addEventListener(eventName, (event) => event.stopPropagation(), { passive: eventName === "wheel" });
            toggle.addEventListener(eventName, (event) => event.stopPropagation(), { passive: eventName === "wheel" });
        }

        return { toggle, panel, setOpen };
    }

    function createIntroUi(app, filterUi, infoUi) {
        const intro = document.createElement("section");
        intro.className = "map-intro";
        intro.setAttribute("aria-label", "How to use the school lens map");
        intro.innerHTML = `
            <p><strong>Explore the map:</strong> Drag any lens to compare areas and tap a school dot for details.</p>
            <p>Use <button type="button" data-open-panel="filters">School filters</button> to refine the view. Open <button type="button" data-open-panel="info">About &amp; sources</button> for the data, credits and code.</p>
        `;

        intro.querySelector('[data-open-panel="filters"]').addEventListener("click", () => {
            infoUi.setOpen(false);
            filterUi.setOpen(true);
        });
        intro.querySelector('[data-open-panel="info"]').addEventListener("click", () => {
            filterUi.setOpen(false);
            infoUi.setOpen(true);
        });
        for (const eventName of ["pointerdown", "dblclick", "wheel"]) {
            intro.addEventListener(eventName, (event) => event.stopPropagation(), { passive: eventName === "wheel" });
        }
        app.append(intro);
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

        const hasEthosPreference = validPercentage(school.denomPct) && validPercentage(school.multiPct);
        const ethosPreference = hasEthosPreference
            ? `${preferenceRow("Denominational", Number(school.denomPct), PARENT_COLORS.denom)}
               ${preferenceRow("Multi-denominational", Number(school.multiPct), PARENT_COLORS.multi)}`
            : '<div class="school-popup-no-data">No parental-preference survey data is available for this school area.</div>';
        const hasSchoolTypePreference = validPercentage(school.singleSexPct) && validPercentage(school.coedPct);
        const schoolTypePreference = hasSchoolTypePreference
            ? `${preferenceRow("Single-sex", Number(school.singleSexPct), PARENT_COLORS.singleSex)}
               ${preferenceRow("Coeducational", Number(school.coedPct), PARENT_COLORS.coed)}`
            : '<div class="school-popup-no-data">No school-type preference data is available for this school area.</div>';
        const hasLanguagePreference = validPercentage(school.englishPct) && validPercentage(school.irishPct);
        const languagePreference = hasLanguagePreference
            ? `${preferenceRow("English", Number(school.englishPct), PARENT_COLORS.english)}
               ${preferenceRow("Irish", Number(school.irishPct), PARENT_COLORS.irish)}`
            : '<div class="school-popup-no-data">No language preference data is available for this school area.</div>';
        const schoolTypeColor = SCHOOL_TYPE_COLORS[school.schoolGender] || "#777";
        const languageColor = LANGUAGE_COLORS[school.instructionLanguage] || "#777";
        const participation = validPercentage(school.participationPct)
            ? `${Math.round(Number(school.participationPct))}%`
            : "Not available";

        element.innerHTML = `
            <button class="school-popup-close" type="button" aria-label="Close school details">×</button>
            <h3>${escapeHtml(school.name)}</h3>
            <p class="school-popup-county">${escapeHtml(school.county || "Ireland")}</p>
            <p class="school-popup-participation">
                <span>Parent survey participation</span>
                <strong>${participation}</strong>
            </p>
            <div class="school-popup-tags">
                <div class="school-popup-ethos">
                    <span class="school-color-dot" style="background:${ETHOS_COLORS[school.ethos] || "#777"}"></span>
                    ${escapeHtml(school.ethos)}
                </div>
                <div class="school-popup-ethos">
                    <span class="school-color-dot" style="background:${schoolTypeColor}"></span>
                    ${escapeHtml(school.schoolGender || "Unknown school type")}
                </div>
                <div class="school-popup-ethos">
                    <span class="school-color-dot" style="background:${languageColor}"></span>
                    ${escapeHtml(school.instructionLanguage || "Unknown language")}
                </div>
            </div>
            <div class="school-popup-heading">Preferred Language</div>
            ${languagePreference}
            <div class="school-popup-heading">Preferred Ethos</div>
            ${ethosPreference}
            <div class="school-popup-heading">Preferred School Type</div>
            ${schoolTypePreference}
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

    function installLensSchoolCounts(map, app, groups, getVisiblePoints) {
        const badges = new Map();
        const preferenceFields = {
            "1": ["englishPct", "irishPct"],
            "2": ["denomPct", "multiPct"],
            "3": ["singleSexPct", "coedPct"],
        };

        for (const group of groups) {
            const badge = document.createElement("div");
            badge.className = "lens-school-count";
            badge.dataset.lensId = String(group.id);
            badge.setAttribute("aria-live", "polite");
            app.appendChild(badge);
            badges.set(String(group.id), { badge, label: group.label });
        }

        const lensBounds = (lensId) => {
            const rim = document.querySelector(`.vq-lens-${lensId}-rim`);
            if (!rim) return null;

            let ancestor = rim.parentElement;
            while (ancestor && ancestor.tagName.toLowerCase() !== "svg") {
                const handles = ancestor.querySelectorAll(".vq-lens-handle");
                if (handles.length === 1) {
                    const handleBounds = handles[0].getBoundingClientRect();
                    if (handleBounds.width > 40 && handleBounds.height > 40) return handleBounds;
                }
                ancestor = ancestor.parentElement;
            }
            return rim.getBoundingClientRect();
        };

        const update = () => {
            const appBounds = app.getBoundingClientRect();
            const canvasBounds = map.getCanvas().getBoundingClientRect();
            const projectedSchools = getVisiblePoints().map((school) => {
                const point = map.project([Number(school.lng), Number(school.lat)]);
                return {
                    school,
                    x: canvasBounds.left - appBounds.left + point.x,
                    y: canvasBounds.top - appBounds.top + point.y,
                };
            });

            for (const [lensId, entry] of badges) {
                const bounds = lensBounds(lensId);
                if (!bounds || bounds.width < 40 || bounds.height < 40) {
                    entry.badge.hidden = true;
                    continue;
                }

                const centerX = bounds.left - appBounds.left + bounds.width / 2;
                const centerY = bounds.top - appBounds.top + bounds.height / 2;
                const radius = Math.min(bounds.width, bounds.height) / 2;
                const requiredFields = preferenceFields[lensId] || [];
                const count = projectedSchools.reduce((total, item) => {
                    if (!requiredFields.every((field) => validPercentage(item.school[field]))) return total;
                    const distance = Math.hypot(item.x - centerX, item.y - centerY);
                    return total + (distance <= radius ? 1 : 0);
                }, 0);

                entry.badge.hidden = false;
                entry.badge.textContent = `${count.toLocaleString()} ${count === 1 ? "school" : "schools"}`;
                entry.badge.setAttribute(
                    "aria-label",
                    `${count.toLocaleString()} schools analysed in the ${entry.label} lens`
                );
                entry.badge.style.left = `${centerX + radius * 0.32}px`;
                entry.badge.style.top = `${centerY + radius * 0.63}px`;
            }
        };

        let timer = 0;
        let animateUntil = 0;
        const tick = () => {
            timer = 0;
            update();
            if (Date.now() < animateUntil) timer = window.setTimeout(tick, 80);
        };
        const animate = (duration = 180) => {
            animateUntil = Math.max(animateUntil, Date.now() + duration);
            if (!timer) tick();
        };

        for (const eventName of ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel"]) {
            window.addEventListener(eventName, () => animate(eventName === "pointermove" ? 140 : 1000), {
                capture: true,
                passive: true,
            });
        }
        map.on("move", () => animate(180));
        map.on("zoom", () => animate(180));
        new ResizeObserver(() => animate(500)).observe(app);
        animate(1500);

        return { animate };
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
        const schoolTypeTotals = Object.fromEntries(SCHOOL_TYPES.map((schoolType) => [schoolType, 0]));
        for (const point of basePoints) {
            schoolTypeTotals[point.schoolGender] = (schoolTypeTotals[point.schoolGender] || 0) + 1;
        }
        const languageTotals = Object.fromEntries(LANGUAGES.map((language) => [language, 0]));
        for (const point of basePoints) {
            languageTotals[point.instructionLanguage] = (languageTotals[point.instructionLanguage] || 0) + 1;
        }

        const filterUi = createFilterUi(app, totals, schoolTypeTotals, languageTotals);
        const infoUi = createInfoUi(app, filterUi.controls, () => filterUi.setOpen(false));
        filterUi.toggle.addEventListener("click", () => infoUi.setOpen(false));
        createIntroUi(app, filterUi, infoUi);
        const { panel } = filterUi;
        const ethosInputs = [...panel.querySelectorAll("[data-ethos]")];
        const schoolTypeInputs = [...panel.querySelectorAll("[data-school-type]")];
        const languageInputs = [...panel.querySelectorAll("[data-language]")];
        const colourModeInputs = [...panel.querySelectorAll('[name="point-colour-mode"]')];
        const preferenceField = panel.querySelector("#preference-field");
        const thresholdInput = panel.querySelector("#preference-threshold");
        const thresholdWrap = panel.querySelector("#preference-threshold-wrap");
        const thresholdValue = panel.querySelector("#preference-threshold-value");
        const countElement = panel.querySelector("#school-filter-count strong");
        let renderVersion = 0;
        let visiblePoints = basePoints;
        let lensCounts = null;
        const selectedColourMode = () => (
            colourModeInputs.find((input) => input.checked)?.value || "ethos"
        );

        const refresh = () => {
            const selectedEthos = new Set(
                ethosInputs.filter((input) => input.checked).map((input) => input.dataset.ethos)
            );
            const selectedSchoolTypes = new Set(
                schoolTypeInputs.filter((input) => input.checked).map((input) => input.dataset.schoolType)
            );
            const selectedLanguages = new Set(
                languageInputs.filter((input) => input.checked).map((input) => input.dataset.language)
            );
            const preference = preferenceField.value;
            const threshold = Number(thresholdInput.value);
            const preferenceFields = {
                english: "englishPct",
                irish: "irishPct",
                denom: "denomPct",
                multi: "multiPct",
                singleSex: "singleSexPct",
                coed: "coedPct",
            };
            const filteredPoints = basePoints.filter((point) => {
                if (!selectedEthos.has(point.ethos)) return false;
                if (!selectedSchoolTypes.has(point.schoolGender)) return false;
                if (!selectedLanguages.has(point.instructionLanguage)) return false;
                if (preference === "any") return true;
                const value = point[preferenceFields[preference]];
                return validPercentage(value) && Number(value) >= threshold;
            });
            visiblePoints = filteredPoints;

            const version = ++renderVersion;
            const syncRenderedPoints = () => {
                window.setTimeout(() => {
                    waitForLayer(map).then(() => {
                        if (version !== renderVersion) return;
                        applySchoolPoints(map, filteredPoints, selectedColourMode());
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
            if (lensCounts) lensCounts.animate(1200);
            countElement.textContent = `${filteredPoints.length.toLocaleString()} of ${basePoints.length.toLocaleString()}`;
            closePopup();
            window.setTimeout(syncRenderedPoints, 300);
        };

        for (const input of ethosInputs) input.addEventListener("change", refresh);
        for (const input of schoolTypeInputs) input.addEventListener("change", refresh);
        for (const input of languageInputs) input.addEventListener("change", refresh);
        for (const input of colourModeInputs) {
            input.addEventListener("change", () => {
                waitForLayer(map)
                    .then(() => applySchoolPoints(map, visiblePoints, selectedColourMode()))
                    .catch((error) => console.error("Could not recolour school points:", error));
            });
        }
        panel.querySelector("#select-all-ethos").addEventListener("click", () => {
            ethosInputs.forEach((input) => { input.checked = true; });
            refresh();
        });
        panel.querySelector("#select-all-school-types").addEventListener("click", () => {
            schoolTypeInputs.forEach((input) => { input.checked = true; });
            refresh();
        });
        panel.querySelector("#select-all-languages").addEventListener("click", () => {
            languageInputs.forEach((input) => { input.checked = true; });
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
            schoolTypeInputs.forEach((input) => { input.checked = true; });
            languageInputs.forEach((input) => { input.checked = true; });
            colourModeInputs.forEach((input) => { input.checked = input.value === "ethos"; });
            preferenceField.value = "any";
            thresholdInput.value = "50";
            thresholdInput.disabled = true;
            thresholdValue.textContent = "50%";
            thresholdWrap.classList.add("is-disabled");
            refresh();
        });

        await waitForLayer(map);
        installMapInteractions(map, app, detailsById, () => visiblePoints);
        lensCounts = installLensSchoolCounts(map, app, payload.groups, () => visiblePoints);
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
