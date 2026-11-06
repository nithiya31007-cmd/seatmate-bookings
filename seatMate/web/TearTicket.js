const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const point = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;

function makeGeometry(width, height, stubSize, radius, holes, holeSize, notch, roughness, vertical) {
  const main = vertical ? height : width;
  const cross = vertical ? width : height;
  const seam = main - stubSize;
  const holeRadius = holeSize / 2;
  const count = Math.max(1, Math.round(holes));
  const bridge = Math.max(2, (cross - 2 * notch - count * holeSize) / (count + 1));
  const at = (u, v) => vertical ? point(v, u) : point(u, v);
  const arc = (r, sweep, u, v) =>
    `A${r.toFixed(2)},${r.toFixed(2)} 0 0 ${vertical ? 1 - sweep : sweep} ${at(u, v)}`;
  let seed = count * 7919 + Math.round(cross);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const bridges = [];
  for (let index = 0; index <= count; index += 1) {
    const start = notch + index * (bridge + holeSize);
    const end = start + bridge;
    const steps = Math.max(2, Math.round(bridge / 2.2));
    const points = [];
    for (let step = 1; step < steps; step += 1) {
      points.push([
        seam + (random() - 0.5) * 2 * roughness,
        start + (bridge * step) / steps,
      ]);
    }
    bridges.push({ start, end, points });
  }

  let body = `M${at(radius, 0)}L${at(seam - notch, 0)}${arc(notch, 0, seam, notch)}`;
  bridges.forEach((section, index) => {
    section.points.forEach(([u, v]) => {
      body += `L${at(u, v)}`;
    });
    body += `L${at(seam, section.end)}`;
    if (index < count) body += arc(holeRadius, 0, seam, section.end + holeSize);
  });
  body += `${arc(notch, 0, seam - notch, cross)}L${at(radius, cross)}`;
  body += `${arc(radius, 1, 0, cross - radius)}L${at(0, radius)}${arc(radius, 1, radius, 0)}Z`;

  let stub = `M${at(seam + notch, 0)}L${at(main - radius, 0)}`;
  stub += `${arc(radius, 1, main, radius)}L${at(main, cross - radius)}`;
  stub += `${arc(radius, 1, main - radius, cross)}L${at(seam + notch, cross)}`;
  stub += arc(notch, 0, seam, cross - notch);
  for (let index = count; index >= 0; index -= 1) {
    const section = bridges[index];
    for (let pointIndex = section.points.length - 1; pointIndex >= 0; pointIndex -= 1) {
      const [u, v] = section.points[pointIndex];
      stub += `L${at(u, v)}`;
    }
    stub += `L${at(seam, section.start)}`;
    if (index > 0) stub += arc(holeRadius, 0, seam, section.start - holeSize);
  }
  stub += `${arc(notch, 0, seam + notch, 0)}Z`;

  const bodyOutline = `M${at(seam, cross - notch)}${arc(notch, 0, seam - notch, cross)}`;
  const bodyRemainder = `L${at(radius, cross)}${arc(radius, 1, 0, cross - radius)}`;
  const bodyEnd = `L${at(0, radius)}${arc(radius, 1, radius, 0)}L${at(seam - notch, 0)}${arc(notch, 0, seam, notch)}`;
  const stubOutline = `M${at(seam, notch)}${arc(notch, 0, seam + notch, 0)}`;
  const stubRemainder = `L${at(main - radius, 0)}${arc(radius, 1, main, radius)}`;
  const stubEnd = `L${at(main, cross - radius)}${arc(radius, 1, main - radius, cross)}L${at(seam + notch, cross)}${arc(notch, 0, seam, cross - notch)}`;

  return {
    seam,
    cross,
    vertical,
    body,
    stub,
    bodyOutline: bodyOutline + bodyRemainder + bodyEnd,
    stubOutline: stubOutline + stubRemainder + stubEnd,
    bridges: bridges.map((section) => (section.start + section.end) / 2),
  };
}

function appendEdge(parent, width, height, pathData, className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("tear-ticket__edge", className);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  svg.append(path);
  parent.append(svg);
}

export default function TearTicket({
  children = null,
  stub = null,
  image = "",
  imageAlt = "",
  scrim = true,
  imageRadius = 8,
  orientation = "horizontal",
  onTear = async () => {},
  onTorn = () => {},
  width = 460,
  height = 250,
  stubSize = 150,
  radius = 16,
  holes = 12,
  holeSize = 6,
  notch = 3,
  roughness = 0,
  tearAngle = 30,
  stretch = 30,
  resistance = 0.45,
  rotate = 4,
  tilt = true,
  tiltMax = 9,
  tiltReach = 260,
  parallax = 6,
  perspective = 1000,
  background = "#27272a",
  color = "#f5f5f5",
  border = true,
  borderWidth = 1,
  stubBackground = "",
  recenter = true,
  disabled = false,
  ariaLabel = "Tear off the stub",
  className = "",
}) {
  const vertical = orientation === "vertical";
  const geometry = makeGeometry(width, height, stubSize, radius, holes, holeSize, notch, roughness, vertical);
  const ticket = document.createElement("article");
  ticket.className = `tear-ticket${className ? ` ${className}` : ""}`;
  ticket.dataset.orientation = orientation;
  if (disabled) ticket.dataset.disabled = "";
  ticket.setAttribute("aria-label", "Booking ticket");
  ticket.style.setProperty("--tt-width", `${width}px`);
  ticket.style.setProperty("--tt-height", `${height}px`);
  ticket.style.setProperty("--tt-stub", `${stubSize}px`);
  ticket.style.setProperty("--tt-background", background);
  ticket.style.setProperty("--tt-stub-background", stubBackground || background);
  ticket.style.setProperty("--tt-color", color);
  ticket.style.setProperty("--tt-edge", color);
  ticket.style.setProperty("--tt-edge-width", `${border ? borderWidth : 0}px`);
  ticket.style.setProperty("--tt-image-radius", `${imageRadius}px`);
  ticket.style.setProperty("--tt-parallax", `${parallax}px`);
  ticket.style.setProperty("--tt-perspective", `${perspective}px`);
  ticket.style.setProperty("--tt-rotate", `${rotate}deg`);

  const stage = document.createElement("div");
  stage.className = "tear-ticket__stage";
  const plane = document.createElement("div");
  plane.className = "tear-ticket__plane";
  const bodyPiece = document.createElement("div");
  bodyPiece.className = "tear-ticket__piece tear-ticket__piece--body";
  bodyPiece.style.clipPath = `path('${geometry.body}')`;
  appendEdge(bodyPiece, width, height, geometry.bodyOutline, "tear-ticket__edge--body");

  const paper = document.createElement("div");
  paper.className = "tear-ticket__paper";
  if (image) {
    const artwork = document.createElement("div");
    artwork.className = "tear-ticket__art";
    const imageElement = document.createElement("img");
    imageElement.className = "tear-ticket__image";
    imageElement.src = image;
    imageElement.alt = imageAlt;
    imageElement.draggable = false;
    artwork.append(imageElement);
    if (scrim) {
      const overlay = document.createElement("div");
      overlay.className = "tear-ticket__scrim";
      artwork.append(overlay);
    }
    paper.append(artwork);
  } else {
    paper.classList.add("tear-ticket__paper--art");
  }
  const content = document.createElement("div");
  content.className = "tear-ticket__content";
  if (children instanceof Node) content.append(children);
  else if (typeof children === "string") content.textContent = children;
  paper.append(content);
  bodyPiece.append(paper);

  const fibres = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  fibres.classList.add("tear-ticket__fibres");
  fibres.setAttribute("viewBox", `0 0 ${width} ${height}`);
  fibres.setAttribute("aria-hidden", "true");
  const fibrePaths = geometry.bridges.map((position) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.dataset.position = String(position);
    fibres.append(path);
    return path;
  });

  const stubPiece = document.createElement("div");
  stubPiece.className = "tear-ticket__piece tear-ticket__piece--stub";
  stubPiece.style.clipPath = `path('${geometry.stub}')`;
  stubPiece.setAttribute("role", "button");
  stubPiece.setAttribute("tabindex", disabled ? "-1" : "0");
  stubPiece.setAttribute("aria-label", ariaLabel);
  stubPiece.setAttribute("aria-disabled", String(disabled));
  const stubPaper = document.createElement("div");
  stubPaper.className = "tear-ticket__paper tear-ticket__paper--stub";
  const stubContent = document.createElement("div");
  stubContent.className = "tear-ticket__stub-content";
  if (stub instanceof Node) stubContent.append(stub);
  else if (typeof stub === "string") stubContent.textContent = stub;
  stubPaper.append(stubContent);
  const tearHint = document.createElement("span");
  tearHint.className = "tear-ticket__hint";
  tearHint.innerHTML = '<span>Pull to tear</span><span aria-hidden="true">✂</span>';
  stubPaper.append(tearHint);
  stubPiece.append(stubPaper);
  appendEdge(stubPiece, width, height, geometry.stubOutline, "tear-ticket__edge--stub");

  plane.append(bodyPiece, fibres, stubPiece);
  stage.append(plane);
  ticket.append(stage);

  const rootObserver = new ResizeObserver(() => {
    const fit = Math.min(1, ticket.clientWidth / width) || 1;
    ticket.style.height = `${height * fit}px`;
    ticket.style.setProperty("--tt-fit", String(fit));
  });
  rootObserver.observe(ticket);

  let pointerId = null;
  let startPoint = null;
  let hinge = null;
  let pulled = 0;
  let busy = false;
  let torn = false;

  const updatePull = (event) => {
    if (pointerId !== event.pointerId || !startPoint || !hinge) return;
    const rect = stage.getBoundingClientRect();
    const fit = rect.width / width || 1;
    const x = (event.clientX - rect.left) / fit;
    const y = (event.clientY - rect.top) / fit;
    const away = vertical ? y - startPoint.y : x - startPoint.x;
    const across = vertical ? x - startPoint.x : y - startPoint.y;
    pulled = clamp(away, 0, stretch * 2);
    const angle = clamp(Math.atan2(Math.max(0, away), Math.max(1, Math.abs(across))) * (180 / Math.PI), 0, tearAngle);
    const resistanceFactor = 1 - clamp(resistance, 0, 0.95) * 0.45;
    const progress = Math.max(angle / tearAngle, pulled / Math.max(1, stretch * resistanceFactor));
    const sign = hinge.side;
    const translate = pulled * 0.38;
    const rotation = Math.min(tearAngle, progress * tearAngle) * sign;
    stubPiece.style.transformOrigin = `${hinge.x}px ${hinge.y}px`;
    stubPiece.style.transform = vertical
      ? `translateY(${translate}px) rotate(${rotation}deg)`
      : `translateX(${translate}px) rotate(${rotation}deg)`;
    stubPiece.style.setProperty("--tt-pull", `${pulled}px`);
    fibrePaths.forEach((path, index) => {
      const seam = geometry.seam;
      const position = Number(path.dataset.position);
      const bodyX = vertical ? position : seam;
      const bodyY = vertical ? seam : position;
      const stubX = bodyX + (vertical ? 0 : translate);
      const stubY = bodyY + (vertical ? translate : 0);
      path.setAttribute("d", `M${bodyX},${bodyY} Q${bodyX + (stubX - bodyX) / 2},${bodyY + (stubY - bodyY) / 2} ${stubX},${stubY}`);
      path.style.opacity = String(clamp(progress * 1.4 - index * 0.025, 0, 0.9));
      path.style.strokeWidth = String(Math.max(0.5, 1.7 - progress));
    });
    ticket.dataset.grabbing = "";
    ticket.style.setProperty("--tt-tilt-x", "0deg");
    ticket.style.setProperty("--tt-tilt-y", "0deg");
    ticket.style.setProperty("--tt-parallax-x", "0px");
    ticket.style.setProperty("--tt-parallax-y", "0px");
  };

  const settle = () => {
    pointerId = null;
    startPoint = null;
    hinge = null;
    pulled = 0;
    delete ticket.dataset.grabbing;
    stubPiece.style.transform = "";
    stubPiece.style.removeProperty("transform-origin");
    stubPiece.style.removeProperty("--tt-pull");
    fibrePaths.forEach((path) => {
      path.style.opacity = "0";
    });
  };

  const removeStub = async () => {
    if (busy || torn) return;
    busy = true;
    stubPiece.setAttribute("aria-disabled", "true");
    stubPiece.setAttribute("tabindex", "-1");
    settle();
    try {
      await onTear();
      torn = true;
      ticket.dataset.used = "";
      stubPiece.setAttribute("aria-hidden", "true");
      stubPiece.style.transformOrigin = vertical ? "50% 100%" : "100% 50%";
      stubPiece.classList.add("tear-ticket__stub--falling");
      if (recenter) ticket.dataset.recenter = "";
      const animation = stubPiece.getAnimations().find((item) => item.animationName === "tear-ticket-stub-fall");
      if (animation) await animation.finished;
      stubPiece.remove();
      fibres.remove();
      rootObserver.disconnect();
      onTorn();
    } catch (error) {
      busy = false;
      stubPiece.setAttribute("aria-disabled", String(disabled));
      stubPiece.setAttribute("tabindex", disabled ? "-1" : "0");
      stubPiece.removeAttribute("aria-hidden");
      let alert = ticket.querySelector(".tear-ticket__error");
      if (!alert) {
        alert = document.createElement("span");
        alert.className = "tear-ticket__error";
        alert.setAttribute("role", "alert");
        ticket.append(alert);
      }
      alert.textContent = error instanceof Error ? error.message : "Could not remove this booking.";
    }
  };

  const onPointerDown = (event) => {
    if (disabled || busy || torn || event.button !== 0) return;
    const rect = stage.getBoundingClientRect();
    const fit = rect.width / width || 1;
    const x = (event.clientX - rect.left) / fit;
    const y = (event.clientY - rect.top) / fit;
    const crossPoint = vertical ? x : y;
    const first = crossPoint < geometry.cross / 2;
    const hingeCross = first ? notch : geometry.cross - notch;
    hinge = vertical
      ? { x: hingeCross, y: geometry.seam, side: first ? -1 : 1 }
      : { x: geometry.seam, y: hingeCross, side: first ? 1 : -1 };
    startPoint = { x, y };
    pointerId = event.pointerId;
    try {
      stubPiece.setPointerCapture(event.pointerId);
    } catch {
      pointerId = null;
      startPoint = null;
      hinge = null;
      return;
    }
    event.preventDefault();
  };

  stubPiece.addEventListener("pointerdown", onPointerDown);
  stubPiece.addEventListener("pointermove", updatePull);
  stubPiece.addEventListener("pointerup", async (event) => {
    if (pointerId !== event.pointerId) return;
    const rect = stage.getBoundingClientRect();
    const fit = rect.width / width || 1;
    const current = vertical
      ? (event.clientY - rect.top) / fit
      : (event.clientX - rect.left) / fit;
    const origin = vertical ? startPoint.y : startPoint.x;
    const threshold = Math.max(12, stretch * clamp(resistance, 0.2, 0.9));
    if (Math.abs(current - origin) >= threshold) await removeStub();
    else settle();
  });
  stubPiece.addEventListener("pointercancel", settle);
  stubPiece.addEventListener("lostpointercapture", settle);
  stubPiece.addEventListener("keydown", (event) => {
    if (disabled || busy || torn || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    if (!event.repeat) removeStub();
  });
  stubPiece.addEventListener("dragstart", (event) => event.preventDefault());

  if (tilt) {
    ticket.addEventListener("pointermove", (event) => {
      if (disabled || event.pointerType === "touch" || pointerId !== null) return;
      const rect = ticket.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      if (Math.hypot(x, y) > tiltReach + Math.max(rect.width, rect.height) / 2) return;
      ticket.style.setProperty("--tt-tilt-x", `${clamp((-y / rect.height) * tiltMax, -tiltMax, tiltMax)}deg`);
      ticket.style.setProperty("--tt-tilt-y", `${clamp((x / rect.width) * tiltMax, -tiltMax, tiltMax)}deg`);
      ticket.style.setProperty("--tt-parallax-x", `${clamp((x / rect.width) * parallax, -parallax, parallax)}px`);
      ticket.style.setProperty("--tt-parallax-y", `${clamp((y / rect.height) * parallax, -parallax, parallax)}px`);
    });
    if (recenter) {
      ticket.addEventListener("pointerleave", () => {
        ticket.style.setProperty("--tt-tilt-x", "0deg");
        ticket.style.setProperty("--tt-tilt-y", "0deg");
        ticket.style.setProperty("--tt-parallax-x", "0px");
        ticket.style.setProperty("--tt-parallax-y", "0px");
      });
    }
  }

  return ticket;
}
