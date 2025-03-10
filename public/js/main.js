document.addEventListener('DOMContentLoaded', () => {
  const apiKey = 'oNPStFf3JMcXlMMkijejrRuhEuW25N55xUqrwYvG'; // Replace with your actual API key
  window.olamapsApiKey = apiKey; // Expose for global routing calls
  
// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/js/sw.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

const headerElement = document.querySelector('header');
if (headerElement) {
  const logoutButton = document.createElement('div');
  logoutButton.id = 'logoutButton';
  logoutButton.textContent = 'Logout';
  logoutButton.style.cursor = 'pointer';
  logoutButton.style.marginLeft = 'auto'; // push it to the right if using flex
  logoutButton.style.padding = '5px 10px';
  logoutButton.style.color = '#fff'; 
  logoutButton.style.fontWeight = 'bold';
  // Attach event to remove token & redirect to login
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
  });
  // Insert into header
  headerElement.appendChild(logoutButton);
}
  const olaMaps = new OlaMaps({ apiKey });
  const autoFit = true;
  
  // Initialize the map and store it globally on window.myMap
  window.myMap = olaMaps.init({
    style: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
    container: 'map',
    center: [75.238167, 30.322],
    zoom: autoFit ? 10 : 12
  });
  
  // ======= Side Panel Toggle Logic =======
  const menuIcon = document.getElementById('menuIcon');
  const sidePanel = document.getElementById('sidePanel');
  const closePanel = document.getElementById('closePanel');
  menuIcon.addEventListener('click', () => sidePanel.classList.add('open'));
  closePanel.addEventListener('click', () => sidePanel.classList.remove('open'));
  
  let allLats = [];
  let allLngs = [];
  
  // ======= Add Geolocate Control =======
  window.currentLocation = null;
  const geolocate = olaMaps.addGeolocateControls({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: false
  });
  window.myMap.addControl(geolocate);
  
  geolocate.on('geolocate', (event) => {
    const { latitude, longitude } = event.coords;
    console.log('User geolocated (blue circle shown by default):', latitude, longitude);
    window.currentLocation = { lat: latitude, lng: longitude };
  });
  
  geolocate.on('error', (e) => {
    console.error('Geolocate error:', e);
    if (e.code === 1) {
      alert("Location access was denied. Please allow location access in your browser settings.");
    }
  });
  
  const currentLocationButton = document.getElementById('currentLocationButton');
  currentLocationButton.addEventListener('click', () => {
    geolocate.trigger();
  });
  
  // ======= Fetch Assignments, Add Markers & Build Side Panel =======
  window.myMap.on('load', async () => {
    console.log("Ola Maps loaded successfully for assignments.");
    const username = localStorage.getItem('username');
    const token = localStorage.getItem('token');
    if (!username || !token) {
      console.error("Username or token missing");
      return;
    }
    try {
      const response = await fetch(`/api/site-assignments/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      console.log("Site assignments fetch result:", result);
  
      if (!result.success && result.message === "Invalid or expired token") {
        alert("Session expired. Please log in again.");
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/login.html';
        return;
      }
      if (!response.ok || !result.success || result.data.length === 0) {
        console.warn("No assignments found for team:", username);
        return;
      }
  
      let globalAssignments = result.data;
  
      // Helper function to add a marker with a custom popup and Final Checklist button
      function addMarker(lng, lat, doc) {
        const markerEl = document.createElement('div');
        markerEl.style.width = '32px';
        markerEl.style.height = '32px';
        markerEl.style.backgroundSize = 'contain';
        markerEl.style.backgroundRepeat = 'no-repeat';
        markerEl.style.backgroundPosition = 'center';
      
        if (doc.type === 'BQ') {
          markerEl.style.backgroundImage = "url('./assets/bq_marker.png')";
        } else {
          // For GP markers, choose icon based on phase:
          if (doc.phase === 'PHASE-1' || doc.phase === 'PHASE-2') {
            markerEl.style.backgroundImage = "url('./assets/brown_marker.png')";
          } else if (doc.phase === 'Newly created') {
            markerEl.style.backgroundImage = "url('./assets/green_marker.png')";
          } else {
            markerEl.style.backgroundImage = "url('./assets/default_marker.png')";
          }
        }
      
        const nameText = (doc.type === 'GP')
          ? (doc.gpName || doc.name || 'Unknown')
          : (doc.block || 'Unknown');
        const navigateButtonText = (doc.type === 'BQ') ? 'Navigate Route to BQ' : 'Navigate Route to GP';
      
        // Note: Pass the document _id to the finishChecklist function.
        const popupContent = `
          <div style="font-family: Arial, sans-serif; font-size: 14px;">
            <p><strong>${(doc.type === 'GP') ? 'GP Name' : 'BQ Name'}:</strong> ${nameText}</p>
            <p><strong>Coordinates:</strong> (${lng.toFixed(5)}, ${lat.toFixed(5)})</p>
            <button onclick="navigateRoute(${lng}, ${lat}, '${doc.type}')" style="margin: 5px; padding: 5px 10px;">${navigateButtonText}</button>
            <button onclick="finishChecklist(${JSON.stringify(doc).replace(/"/g, '&quot;')})" style="margin: 5px; padding: 5px 10px;">Final Checklist</button>
          </div>
        `;
      
        const popup = olaMaps.addPopup({
          offset: [0, -30],
          anchor: 'bottom'
        }).setHTML(popupContent);
      
        olaMaps.addMarker({
          element: markerEl,
          anchor: 'bottom',
          offset: [0, -16]
        })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(window.myMap);
      
        console.log(`Added marker for ${doc.type} with phase "${doc.phase}" at [${lng}, ${lat}]`);
        allLats.push(lat);
        allLngs.push(lng);
      }
      
      globalAssignments.forEach(doc => {
        const lng = parseFloat(doc.longitude);
        const lat = parseFloat(doc.latitude);
        if (!isNaN(lng) && !isNaN(lat)) {
          addMarker(lng, lat, doc);
        }
      });
      
      if (autoFit && allLats.length > 0 && allLngs.length > 0) {
        const minLat = Math.min(...allLats);
        const maxLat = Math.max(...allLats);
        const minLng = Math.min(...allLngs);
        const maxLng = Math.max(...allLngs);
        console.log("Computed bounds:", { minLng, minLat, maxLng, maxLat });
        window.myMap.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, maxZoom: 18 });
      }
      
      buildSidePanel(globalAssignments);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  });
  
  function buildSidePanel(assignments) {
    const sidePanelContent = document.querySelector('.side-panel-content');
    sidePanelContent.innerHTML = '';
  
    const heading = document.createElement('h3');
    heading.textContent = "Site Assigned Task";
    sidePanelContent.appendChild(heading);
  
    const bqListContainer = document.createElement('div');
    bqListContainer.classList.add('bq-list-container');
    sidePanelContent.appendChild(bqListContainer);
  
    let blockGroups = {};
    assignments.forEach(doc => {
      const blockName = doc.block || 'UnknownBlock';
      if (!blockGroups[blockName]) {
        blockGroups[blockName] = { bqDoc: null, gpDocs: [] };
      }
      if (doc.type === 'BQ') {
        blockGroups[blockName].bqDoc = doc;
      } else if (doc.type === 'GP') {
        blockGroups[blockName].gpDocs.push(doc);
      }
    });
  
    Object.keys(blockGroups).forEach(blockName => {
      const group = blockGroups[blockName];
      if (group.bqDoc) {
        const bqItem = document.createElement('div');
        bqItem.classList.add('bq-item');
        bqItem.textContent = blockName;
        bqListContainer.appendChild(bqItem);
  
        bqItem.addEventListener('click', () => {
          showGPList(blockName, group);
        });
      }
    });
  }
  
  function showGPList(blockName, group) {
    const existingGpList = document.querySelector('.gp-list-container');
    if (existingGpList) existingGpList.remove();
  
    const sidePanelContent = document.querySelector('.side-panel-content');
    const gpListContainer = document.createElement('div');
    gpListContainer.classList.add('gp-list-container');
    sidePanelContent.appendChild(gpListContainer);
  
    const gpHeading = document.createElement('h4');
    gpHeading.textContent = `GP for BQ: ${blockName}`;
    gpListContainer.appendChild(gpHeading);
  
    if (group.gpDocs.length === 0) {
      const noGp = document.createElement('div');
      noGp.textContent = "No GP found for this BQ.";
      gpListContainer.appendChild(noGp);
    } else {
      group.gpDocs.forEach(gpDoc => {
        const gpName = gpDoc.gpName || gpDoc.name || 'UnknownGP';
        const district = gpDoc.district || 'UnknownDistrict';
        const gpItem = document.createElement('div');
        gpItem.classList.add('gp-item');
        gpItem.textContent = `GP: ${gpName} | District: ${district}`;
        gpListContainer.appendChild(gpItem);
      });
    }
  }
});
  
// ======= Routing with Directions API =============
function drawRoute(geometry) {
  if (!window.myMap.getSource('routeSource')) {
    window.myMap.addSource('routeSource', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: geometry
      }
    });
    window.myMap.addLayer({
      id: 'routeLayer',
      type: 'line',
      source: 'routeSource',
      paint: {
        'line-color': '#FF0000',
        'line-width': 4
      }
    });
  } else {
    window.myMap.getSource('routeSource').setData({
      type: 'Feature',
      geometry: geometry
    });
  }
}
  
// Polyline decoding function for standard 5-digit polylines
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  const factor = 1e5;
  
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;
  
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;
  
    points.push([lng / factor, lat / factor]);
  }
  return points;
}
  
// Global routing function using Directions API
window.navigateRoute = async function(lng, lat, type) {
  console.log(`Navigating route from user location to [${lng}, ${lat}]`);
  if (!window.currentLocation) {
    alert("No current location found. Please click the get location button first.");
    return;
  }
  
  // Directions API expects origin and destination in "lat,lng" order.
  const origin = `${window.currentLocation.lat},${window.currentLocation.lng}`;
  const destination = `${lat},${lng}`; // Marker coordinates are received as (lng, lat)
  
  const url = `https://api.olamaps.io/routing/v1/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&geometries=polyline6&steps=true&overview=full&api_key=${encodeURIComponent(window.olamapsApiKey)}`;
  console.log("Requesting route from Directions API:", url);
  
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'my-request-id'
      }
    });
    const data = await resp.json();
    console.log("Directions API response:", data);
  
    if (data.status !== "SUCCESS" || !data.routes || data.routes.length === 0) {
      alert("Route request failed or no route found.");
      return;
    }
  
    const polylineStr = data.routes[0].overview_polyline;
    if (!polylineStr) {
      alert("No route polyline found in the response.");
      return;
    }
  
    const coordinates = decodePolyline(polylineStr);
    const routeGeometry = {
      type: "LineString",
      coordinates: coordinates
    };
  
    drawRoute(routeGeometry);
  
    // Auto-fit the map to the route
    const lats = coordinates.map(c => c[1]);
    const lngs = coordinates.map(c => c[0]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    window.myMap.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50 });
  } catch (error) {
    console.error("Error with route request:", error);
    alert("Error requesting route. See console for details.");
  }
};

/****************************************************************************
 * finishChecklist, showBrownChecklistForm, showGreenChecklistForm
 * These functions remain the same as in your code. We only changed how
 * uploadGroup() and uploadMedia() handle audio/video “replay” and fallback.
 ****************************************************************************/

window.finishChecklist = function(doc) {
  // For BQ markers, always use the Brown checklist.
  // For GP markers, if phase === "Newly created" use green, else brown.
  if (doc.type === 'GP' && doc.phase === 'Newly created') {
    showGreenChecklistForm(doc);
  } else {
    showBrownChecklistForm(doc);
  }
};

function showBrownChecklistForm(doc) {
  console.log("Showing BROWN (Phase 1/2 or BQ) checklist form for doc:", doc);
  createChecklistModal(doc, "Brown GPS Checklist", true);
}

function showGreenChecklistForm(doc) {
  console.log("Showing GREEN (Newly created) checklist form for doc:", doc);
  createChecklistModal(doc, "Green GPS Checklist", false);
}

/****************************************************************************
 * createChecklistModal:
 * Builds the overall modal, deciding which table rows to show (brown vs green).
 ****************************************************************************/
function createChecklistModal(doc, titleLabel, isBrown) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const currentDate = `${yyyy}-${mm}-${dd}`;

  const currentLocStr = window.currentLocation
    ? `${window.currentLocation.lat.toFixed(5)},${window.currentLocation.lng.toFixed(5)}`
    : '';

  const districtName = doc.district || '';
  const blockName = doc.block || '';
  const gpName = (doc.type === 'GP') ? (doc.gpName || doc.name || '') : '';

  // Create modal backdrop
  const modal = document.createElement('div');
  modal.id = 'checklistModal';

  // Container for the form
  const formContainer = document.createElement('div');
  formContainer.classList.add('form-container');

  // Title
  const titleEl = document.createElement('h2');
  titleEl.textContent = titleLabel;
  formContainer.appendChild(titleEl);

  // Decide which rows (brown or green)
  let tableRows = isBrown ? getBrownChecklistRows() : getGreenChecklistRows();

  formContainer.innerHTML += `
    <form id="checklistForm">
      <h3>${isBrown ? "Existing Infrastructure (For Block & GP)" : "Unconnected GP Infrastructure (For Newly Created GP)"}</h3>
      <div class="form-row">
        <label>State Name:</label>
        <input type="text" name="stateName" value="punjab" readonly>
      </div>
      <div class="form-row">
        <label>SI Name:</label>
        <input type="text" name="siName" value="guru" readonly>
        <label>Date of Survey:</label>
        <input type="date" name="surveyDate" value="${currentDate}" readonly>
      </div>
      <div class="form-row">
        <label>District ID:</label>
        <input type="text" name="districtId" value="10001" readonly>
        <label>District Name:</label>
        <input type="text" name="districtName" value="${districtName}" readonly>
      </div>
      <div class="form-row">
        <label>Block ID:</label>
        <input type="text" name="blockId" value="102" readonly>
        <label>Block Name:</label>
        <input type="text" name="blockName" value="${blockName}" readonly>
      </div>
      <div class="form-row">
        <label>GP Connected from:</label>
        <input type="text" name="gpConnectedFrom" value="${blockName}" readonly>
        <label>GP Connected to:</label>
        <input type="text" name="gpConnectedTo" value="${gpName}" readonly>
      </div>
      <div class="form-row">
        <label>Site Name:</label>
        <input type="text" name="siteName" placeholder="Enter site name" required>
        <label>Site Address:</label>
        <input type="text" name="siteAddress" placeholder="Enter site address">
      </div>
      <div class="form-row">
        <label>Nearest Landmark:</label>
        <input type="text" name="nearestLandmark" placeholder="Enter nearest landmark">
      </div>
      <h4>Checklist Items</h4>
      <table>
        <tr>
          <th>S. No.</th>
          <th>Action to be Checked</th>
          <th>Field Input</th>
        </tr>
        ${tableRows}
      </table>
      <br>
      <input type="hidden" name="docId" value="${doc._id}">
      <div class="form-actions">
        <button type="submit">Submit Checklist</button>
        <button type="button" id="cancelChecklist">Cancel</button>
      </div>
    </form>
  `;

  modal.appendChild(formContainer);
  document.body.appendChild(modal);

  // Handle form submission
  const checklistForm = document.getElementById('checklistForm');
  checklistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(checklistForm);
    const checklistData = {};
    for (const [key, value] of formData.entries()) {
      checklistData[key] = value;
    }
    console.log("Checklist data submitted:", checklistData);
    // TODO: Send checklistData to your server for storage/analytics
    document.body.removeChild(modal);
  });

  // Handle cancel
  document.getElementById('cancelChecklist').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

/*************************************************************************
 * getBrownChecklistRows - 17 items
 ************************************************************************/
function getBrownChecklistRows() {
  return `
    <tr>
      <td>A1</td>
      <td>Existing SMPS</td>
      <td>${uploadGroup("smpsDetails")}</td>
    </tr>
    <tr>
      <td>A1.1</td>
      <td>Battery (with replacement Date)</td>
      <td>${uploadGroup("batteryDetails")}</td>
    </tr>
    <tr>
      <td>A1.2</td>
      <td>Enclosure</td>
      <td>${uploadGroup("enclosureDetails")}</td>
    </tr>
    <tr>
      <td>A1.3</td>
      <td>Earthing</td>
      <td>${uploadGroup("earthingDetails")}</td>
    </tr>
    <tr>
      <td>A1.4</td>
      <td>CCU</td>
      <td>${uploadGroup("ccuDetails")}</td>
    </tr>
    <tr>
      <td>A1.5</td>
      <td>Solar Panel capacity</td>
      <td>${uploadGroup("solarPanelCapacity")}</td>
    </tr>
    <tr>
      <td>A1.6</td>
      <td>Splitter and condition</td>
      <td>${uploadGroup("splitterDetails")}</td>
    </tr>
    <tr>
      <td>A2</td>
      <td>Space availability inside OD Cabinet</td>
      <td>${uploadGroup("odCabinetSpace")}</td>
    </tr>
    <tr>
      <td>A3</td>
      <td>Existing AC Availability and Capacity</td>
      <td>${uploadGroup("acAvailability")}</td>
    </tr>
    <tr>
      <td>A4</td>
      <td>Existing Transformer capacity and load</td>
      <td>${uploadGroup("transformerCapacity")}</td>
    </tr>
    <tr>
      <td>A5</td>
      <td>AC Cable gauge</td>
      <td>${uploadGroup("acCableGauge")}</td>
    </tr>
    <tr>
      <td>A6</td>
      <td>Vacant position inside ACDB</td>
      <td>${uploadGroup("acdbVacancy")}</td>
    </tr>
    <tr>
      <td>A7</td>
      <td>Vacant position inside DCDB</td>
      <td>${uploadGroup("dcdbVacancy")}</td>
    </tr>
    <tr>
      <td>A8</td>
      <td>DC Cable gauge</td>
      <td>${uploadGroup("dcCableGauge")}</td>
    </tr>
    <tr>
      <td>A9</td>
      <td>Existing DG capacity and condition</td>
      <td>${uploadGroup("dgCondition")}</td>
    </tr>
    <tr>
      <td>A10</td>
      <td>Upgradation required for SMPS, Battery, DG, ACDB, DCDB</td>
      <td>${uploadGroup("upgradeRequired")}</td>
    </tr>
    <tr>
      <td>A11</td>
      <td>Existing OLT, ONT</td>
      <td>${uploadGroup("oltOnt")}</td>
    </tr>
    <tr>
      <td>A12</td>
      <td>Existing FTB, Zero Manhole, termination details</td>
      <td>${uploadGroup("ftbDetails")}</td>
    </tr>
    <tr>
      <td>A13</td>
      <td>Existing fiber health check</td>
      <td>${uploadGroup("fiberHealth")}</td>
    </tr>
    <tr>
      <td>A14</td>
      <td>Record throughput, latency, packet loss, jitter, and SNR values</td>
      <td>${uploadGroup("networkMetrics")}</td>
    </tr>
    <tr>
      <td>A15</td>
      <td>Status of GP (Up or Down)</td>
      <td>${uploadGroup("gpStatus")}</td>
    </tr>
    <tr>
      <td>A16</td>
      <td>Condition of the building – whether the site is to be shifted</td>
      <td>${uploadGroup("buildingCondition")}</td>
    </tr>
    <tr>
      <td>A17</td>
      <td>Availability of grid power (avg. hours per day)</td>
      <td>${uploadGroup("gridPowerAvailability")}</td>
    </tr>
  `;
}

/*************************************************************************
 * getGreenChecklistRows - 12 items
 ************************************************************************/
function getGreenChecklistRows() {
  return `
    <tr>
      <td>A1</td>
      <td>Existing SMPS</td>
      <td>${uploadGroup("smpsDetails")}</td>
    </tr>
    <tr>
      <td>A1.1</td>
      <td>Battery (with replacement Date)</td>
      <td>${uploadGroup("batteryDetails")}</td>
    </tr>
    <tr>
      <td>A1.2</td>
      <td>Enclosure</td>
      <td>${uploadGroup("enclosureDetails")}</td>
    </tr>
    <tr>
      <td>A1.3</td>
      <td>Earthing</td>
      <td>${uploadGroup("earthingDetails")}</td>
    </tr>
    <tr>
      <td>A1.4</td>
      <td>CCU</td>
      <td>${uploadGroup("ccuDetails")}</td>
    </tr>
    <tr>
      <td>A1.5</td>
      <td>Solar Panel capacity</td>
      <td>${uploadGroup("solarPanelCapacity")}</td>
    </tr>
    <tr>
      <td>A1.6</td>
      <td>Splitter and condition</td>
      <td>${uploadGroup("splitterDetails")}</td>
    </tr>
    <tr>
      <td>A2</td>
      <td>Space availability inside OD Cabinet</td>
      <td>${uploadGroup("odCabinetSpace")}</td>
    </tr>
    <tr>
      <td>A3</td>
      <td>Existing AC Availability and Capacity</td>
      <td>${uploadGroup("acAvailability")}</td>
    </tr>
    <tr>
      <td>A4</td>
      <td>Existing Transformer capacity and load</td>
      <td>${uploadGroup("transformerCapacity")}</td>
    </tr>
    <tr>
      <td>A5</td>
      <td>AC Cable gauge</td>
      <td>${uploadGroup("acCableGauge")}</td>
    </tr>
    <tr>
      <td>A6</td>
      <td>Vacant position inside ACDB</td>
      <td>${uploadGroup("acdbVacancy")}</td>
    </tr>
    <tr>
      <td>A7</td>
      <td>Vacant position inside DCDB</td>
      <td>${uploadGroup("dcdbVacancy")}</td>
    </tr>
    <tr>
      <td>A8</td>
      <td>DC Cable gauge</td>
      <td>${uploadGroup("dcCableGauge")}</td>
    </tr>
    <tr>
      <td>A9</td>
      <td>Existing DG capacity and condition - like fuel leakage, AMF, present CPH</td>
      <td>${uploadGroup("dgCondition")}</td>
    </tr>
    <tr>
      <td>A10</td>
      <td>Upgradation required for SMPS, Battery, DG, ACDB, DCDB</td>
      <td>${uploadGroup("upgradeRequired")}</td>
    </tr>
    <tr>
      <td>A11</td>
      <td>Condition of the building – whether the site is to be shifted</td>
      <td>${uploadGroup("buildingCondition")}</td>
    </tr>
    <tr>
      <td>A12</td>
      <td>Availability of grid power (avg. hours per day)</td>
      <td>${uploadGroup("gridPowerAvailability")}</td>
    </tr>
  `;
}

/****************************************************************************
 * 1) The Upload Group Markup
 ****************************************************************************/
function uploadGroup(fieldName, modalId = "defaultModal") {
  const storageKey = modalId + "_" + fieldName;
  let storedUploads = localStorage.getItem(storageKey) || "[]";
  return `
    <div class="upload-group" data-field-name="${fieldName}" data-storage-key="${storageKey}">
      <input type="hidden" name="${fieldName}" value='${storedUploads}' />
      <div class="upload-buttons">
        <!-- Buttons explicitly set to type="button" -->
        <button type="button" formnovalidate onclick="uploadMedia('photo', this)">Upload Photo</button>
        <button type="button" formnovalidate onclick="uploadMedia('video', this)">Upload Video</button>
        <button type="button" formnovalidate onclick="uploadMedia('audio', this)">Upload Audio</button>
      </div>
      <div class="upload-preview-container"></div>
    </div>
  `;
}

/****************************************************************************
 * 2) The Master uploadMedia function
 ****************************************************************************/
function uploadMedia(mediaType, buttonElement) {
  if (mediaType === 'audio') {
    // For mobile devices: force Chrome usage for Web Audio recording
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      if (!/Chrome/i.test(navigator.userAgent)) {
        alert("For the best audio recording experience, please use Google Chrome on your device.");
        fileInputFallback(mediaType, buttonElement);
        return;
      } else {
        console.log("Mobile Chrome detected – using MediaRecorder for audio capture.");
        recordAudioMediaRecorder(buttonElement);
        return;
      }
    }
    // For desktop (or non‑mobile) use MediaRecorder if available
    if (window.MediaRecorder && navigator.mediaDevices) {
      console.log("Using MediaRecorder for audio capture (desktop).");
      recordAudioMediaRecorder(buttonElement);
      return;
    }
    // Otherwise, try ScriptProcessor + lame.js fallback
    if (navigator.mediaDevices && typeof AudioContext === 'function' && window.lamejs) {
      console.log("Falling back to ScriptProcessor + lame.js for MP3 recording.");
      recordAudioMp3(buttonElement);
      return;
    }
    // If nothing works, fallback to file input
    console.log("Using file input fallback for mediaType:", mediaType);
    fileInputFallback(mediaType, buttonElement);
    return;
  }
  // For photo/video, use file input fallback (or add similar logic as needed)
  fileInputFallback(mediaType, buttonElement);
}

/****************************************************************************
 * 3) MediaRecorder Approach (for desktop and mobile Chrome)
 ****************************************************************************/
function recordAudioMediaRecorder(buttonElement) {
  const uploadGroupElem = buttonElement.closest('.upload-group');
  const previewContainer = uploadGroupElem.querySelector('.upload-preview-container');
  previewContainer.innerHTML = `
    <div>
      <button type="button" id="startMR">Start Recording</button>
      <button type="button" id="stopMR" disabled>Stop Recording</button>
      <span class="mrStatus" style="margin-left:10px;">Not recording</span>
    </div>
  `;
  const startBtn = previewContainer.querySelector('#startMR');
  const stopBtn = previewContainer.querySelector('#stopMR');
  const statusSpan = previewContainer.querySelector('.mrStatus');

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const options = { mimeType: 'audio/webm; codecs=opus' };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        console.warn("MediaRecorder creation failed, falling back to ScriptProcessor:", e);
        stream.getTracks().forEach(t => t.stop());
        recordAudioMp3(buttonElement);
        return;
      }
      let chunks = [];
      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          chunks.push(evt.data);
        }
      };
      recorder.onstart = () => {
        chunks = [];
        statusSpan.textContent = "Recording...";
      };
      recorder.onstop = () => {
        statusSpan.textContent = "Stopped. Converting...";
        stream.getTracks().forEach(t => t.stop());
        const recordedBlob = new Blob(chunks, { type: options.mimeType });
        console.log("Recorded blob type:", recordedBlob.type);
        // If the blob type is not as expected, you could try fallback
        if (recordedBlob.type !== options.mimeType) {
          console.warn("Unexpected blob type detected; falling back to ScriptProcessor conversion.");
          recordAudioMp3(buttonElement);
          return;
        }
        // Convert the WebM blob to MP3 (using lame.js)
        convertWebmToMp3(recordedBlob, (mp3Blob, mp3DataURL) => {
          if (!mp3Blob) {
            previewContainer.innerHTML = `<span style="color:red;">Failed converting to MP3.</span>`;
            return;
          }
          previewContainer.innerHTML = `
            <audio controls style="display:block;">
              <source src="${mp3DataURL}" type="audio/mpeg" />
              Your browser does not support audio.
            </audio>
            <div style="margin-top:4px;">
              <strong>Audio Recording (MP3):</strong>
              <button type="button" onclick="deleteUploadedItem(this, 0)">Delete</button>
              <button type="button" onclick="replayMedia(this, 'audio')">Replay</button>
            </div>
          `;
          const hiddenInput = uploadGroupElem.querySelector('input[type="hidden"]');
          let uploadsArray = [];
          try {
            uploadsArray = JSON.parse(hiddenInput.value);
          } catch (err) {
            uploadsArray = [];
          }
          uploadsArray.push({
            mediaType: 'audio',
            fileName: 'recorded_audio.mp3',
            fileType: 'audio/mpeg',
            blobURL: mp3DataURL
          });
          hiddenInput.value = JSON.stringify(uploadsArray);
          const storageKey = uploadGroupElem.getAttribute('data-storage-key');
          localStorage.setItem(storageKey, hiddenInput.value);
          statusSpan.textContent = "Done.";
          startBtn.disabled = false;
        });
      };

      // Attach event listeners with preventDefault
      startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Start Recording button clicked.");
        startBtn.disabled = true;
        stopBtn.disabled = false;
        recorder.start();
      });
      stopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Stop Recording button clicked.");
        stopBtn.disabled = true;
        statusSpan.textContent = "Stopping...";
        recorder.stop();
      });
    })
    .catch(err => {
      console.error("getUserMedia error for MediaRecorder:", err);
      previewContainer.innerHTML = `<span style="color:red;">Microphone not accessible. Falling back to file input.</span>`;
      fileInputFallback('audio', buttonElement);
    });
}

/****************************************************************************
 * 4) ScriptProcessor + lame.js Fallback (for mobile if needed)
 ****************************************************************************/
function recordAudioMp3(buttonElement) {
  // (This function is kept as an alternative fallback)
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    console.error("navigator.mediaDevices.getUserMedia is not supported on this device. Falling back to file input.");
    fileInputFallback('audio', buttonElement);
    return;
  }
  const uploadGroupElem = buttonElement.closest('.upload-group');
  const previewContainer = uploadGroupElem.querySelector('.upload-preview-container');
  previewContainer.innerHTML = `
    <div>
      <button type="button" id="startSP">Start Recording</button>
      <button type="button" id="stopSP" disabled>Stop Recording</button>
      <span class="spStatus" style="margin-left:10px;">Not recording</span>
    </div>
  `;
  
  console.log("Recorder UI rendered:", previewContainer.innerHTML);
  const startBtn = previewContainer.querySelector('#startSP');
  const stopBtn = previewContainer.querySelector('#stopSP');
  const statusSpan = previewContainer.querySelector('.spStatus');
  
  if (!startBtn) {
    console.error("Start Recording button not found!");
    return;
  } else {
    console.log("Start Recording button found.");
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const audioCtx = new AudioContext();
      console.log("AudioContext created. State:", audioCtx.state);
      audioCtx.resume().then(() => {
        console.log("AudioContext resumed. Current state:", audioCtx.state);
      }).catch(err => {
        console.error("Error resuming AudioContext:", err);
      });

      const sampleRate = audioCtx.sampleRate;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioCtx.destination);

      const lameEncoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
      let recording = false;
      let mp3Data = [];

      processor.onaudioprocess = (e) => {
        if (!recording) return;
        const floatSamples = e.inputBuffer.getChannelData(0);
        const intSamples = new Int16Array(floatSamples.length);
        for (let i = 0; i < floatSamples.length; i++) {
          intSamples[i] = floatSamples[i] * 32767;
        }
        const mp3buf = lameEncoder.encodeBuffer(intSamples);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      };

      startBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Start Recording button clicked (fallback).");
        if (audioCtx.state === 'suspended') {
          try {
            await audioCtx.resume();
            console.log("AudioContext resumed in fallback. State:", audioCtx.state);
          } catch (err) {
            console.error("Error resuming AudioContext in fallback:", err);
          }
        }
        recording = true;
        mp3Data = [];
        statusSpan.textContent = "Recording...";
        startBtn.disabled = true;
        stopBtn.disabled = false;
      });

      stopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Stop Recording button clicked (fallback).");
        recording = false;
        statusSpan.textContent = "Stopping...";
        stopBtn.disabled = true;

        const flushBuf = lameEncoder.flush();
        if (flushBuf.length > 0) {
          mp3Data.push(flushBuf);
        }
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();

        const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
        const mp3URL = URL.createObjectURL(mp3Blob);

        previewContainer.innerHTML = `
          <audio controls style="display:block;">
            <source src="${mp3URL}" type="audio/mpeg" />
            Your browser does not support audio.
          </audio>
          <div style="margin-top:4px;">
            <strong>MP3 Recording:</strong>
            <button type="button" onclick="deleteUploadedItem(this, 0)">Delete</button>
            <button type="button" onclick="replayMedia(this, 'audio')">Replay</button>
          </div>
        `;
        const hiddenInput = uploadGroupElem.querySelector('input[type="hidden"]');
        let uploadsArray = [];
        try {
          uploadsArray = JSON.parse(hiddenInput.value);
        } catch (err) {
          uploadsArray = [];
        }
        uploadsArray.push({
          mediaType: 'audio',
          fileName: 'recorded_audio.mp3',
          fileType: 'audio/mpeg',
          blobURL: mp3URL
        });
        hiddenInput.value = JSON.stringify(uploadsArray);
        const storageKey = uploadGroupElem.getAttribute('data-storage-key');
        localStorage.setItem(storageKey, hiddenInput.value);
        statusSpan.textContent = "Done.";
        startBtn.disabled = false;
      });
    })
    .catch(err => {
      console.error("ScriptProcessor getUserMedia error (fallback):", err);
      previewContainer.innerHTML = `<span style="color:red;">Microphone not accessible. Falling back to file input.</span>`;
      fileInputFallback('audio', buttonElement);
    });
}

/****************************************************************************
 * 6) The <input type="file"/> fallback approach
 ****************************************************************************/
function fileInputFallback(mediaType, buttonElement) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';

  if (mediaType === 'photo') {
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment';
  } else if (mediaType === 'video') {
    fileInput.accept = 'video/*';
    fileInput.capture = 'camcorder';
  } else if (mediaType === 'audio') {
    fileInput.accept = 'audio/*';
    fileInput.capture = 'microphone';
  }

  fileInput.onchange = () => {
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const fileName = file.name;
      const fileType = file.type;
      const blobURL = URL.createObjectURL(file);
      appendUploadPreview(buttonElement, { mediaType, fileName, fileType, blobURL });
    }
  };
  fileInput.click();
}

/****************************************************************************
 * 7) convertWebmToMp3: Use AudioContext + lame.js to decode -> encode
 ****************************************************************************/
function convertWebmToMp3(webmBlob, callback) {
  const reader = new FileReader();
  reader.onload = function() {
    const arrayBuffer = reader.result;
    const audioCtx = new AudioContext();
    audioCtx.decodeAudioData(arrayBuffer, (audioBuffer) => {
      const channelData = audioBuffer.getChannelData(0);
      const samples = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
      const blockSize = 1152;
      let mp3Data = [];
      for (let i = 0; i < samples.length; i += blockSize) {
        const chunk = samples.subarray(i, i + blockSize);
        const mp3buf = mp3Encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }
      const flushBuf = mp3Encoder.flush();
      if (flushBuf.length > 0) mp3Data.push(flushBuf);

      const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      const reader2 = new FileReader();
      reader2.onload = function() {
        const mp3DataURL = reader2.result;
        callback(mp3Blob, mp3DataURL);
        audioCtx.close();
      };
      reader2.onerror = function(err) {
        console.error("readAsDataURL mp3Blob error:", err);
        callback(null, null);
      };
      reader2.readAsDataURL(mp3Blob);
    }, (err) => {
      console.error("decodeAudioData error:", err);
      callback(null, null);
    });
  };
  reader.onerror = function(err) {
    console.error("FileReader error on webm blob:", err);
    callback(null, null);
  };
  reader.readAsArrayBuffer(webmBlob);
}

/****************************************************************************
 * 8) appendUploadPreview: If we get a fallback file from user
 ****************************************************************************/
function appendUploadPreview(buttonElement, { mediaType, fileName, fileType, blobURL }) {
  const uploadGroupElem = buttonElement.closest('.upload-group');
  const hiddenInput = uploadGroupElem.querySelector('input[type="hidden"]');
  let uploadsArray = [];
  try {
    uploadsArray = JSON.parse(hiddenInput.value);
  } catch (err) {
    uploadsArray = [];
  }
  const newItem = { mediaType, fileName, fileType, blobURL };
  uploadsArray.push(newItem);
  hiddenInput.value = JSON.stringify(uploadsArray);

  const storageKey = uploadGroupElem.getAttribute('data-storage-key');
  localStorage.setItem(storageKey, hiddenInput.value);

  const previewContainer = uploadGroupElem.querySelector('.upload-preview-container');
  const itemIndex = uploadsArray.length - 1;

  let previewHTML = '';
  if (mediaType === 'photo') {
    previewHTML = `<img src="${blobURL}" alt="${fileName}" style="max-width:100px; height:auto; display:block;" />`;
  } else if (mediaType === 'video') {
    previewHTML = `
      <video controls style="max-width:180px; display:block;">
        <source src="${blobURL}" type="${fileType || 'video/mp4'}" />
        Your browser does not support video.
      </video>
      <button type="button" onclick="replayMedia(this, 'video')">Replay</button>
    `;
  } else if (mediaType === 'audio') {
    previewHTML = `
      <audio controls style="display:block;">
        <source src="${blobURL}" type="${fileType || 'audio/mpeg'}" />
        Your browser does not support audio.
      </audio>
      <button type="button" onclick="replayMedia(this, 'audio')">Replay</button>
    `;
  }

  const mediaItem = document.createElement('div');
  mediaItem.classList.add('media-item');
  mediaItem.style.margin = '5px 0';
  mediaItem.innerHTML = `
    ${previewHTML}
    <div style="margin-top:4px;">
      <strong>${mediaType.toUpperCase()}:</strong> ${fileName}
      <button type="button" onclick="deleteUploadedItem(this, ${itemIndex})" style="margin-left:10px;">Delete</button>
    </div>
  `;
  previewContainer.appendChild(mediaItem);
}

/****************************************************************************
 * 9) replayMedia, deleteUploadedItem, reindexMediaItems
 ****************************************************************************/
function replayMedia(replayButton, type) {
  const container = replayButton.closest('.media-item');
  if (!container) return;
  const mediaElem = container.querySelector(type === 'video' ? 'video' : 'audio');
  if (mediaElem) {
    mediaElem.currentTime = 0;
    mediaElem.play();
  }
}

function deleteUploadedItem(deleteBtn, itemIndex) {
  const mediaItem = deleteBtn.closest('.media-item');
  if (!mediaItem) return;
  const uploadGroupElem = deleteBtn.closest('.upload-group');
  const hiddenInput = uploadGroupElem.querySelector('input[type="hidden"]');
  let uploadsArray = [];
  try {
    uploadsArray = JSON.parse(hiddenInput.value);
  } catch (err) {
    uploadsArray = [];
  }
  if (uploadsArray[itemIndex]) {
    uploadsArray.splice(itemIndex, 1);
  }
  hiddenInput.value = JSON.stringify(uploadsArray);
  const storageKey = uploadGroupElem.getAttribute('data-storage-key');
  localStorage.setItem(storageKey, hiddenInput.value);
  mediaItem.remove();
  reindexMediaItems(uploadGroupElem);
}

function reindexMediaItems(uploadGroupElem) {
  const hiddenInput = uploadGroupElem.querySelector('input[type="hidden"]');
  let uploadsArray = [];
  try {
    uploadsArray = JSON.parse(hiddenInput.value);
  } catch (err) {
    uploadsArray = [];
  }
  const previewContainer = uploadGroupElem.querySelector('.upload-preview-container');
  const mediaItems = previewContainer.querySelectorAll('.media-item');
  mediaItems.forEach((itemElem, newIndex) => {
    const delBtn = itemElem.querySelector('button[onclick^="deleteUploadedItem"]');
    if (delBtn) {
      delBtn.setAttribute('onclick', `deleteUploadedItem(this, ${newIndex})`);
    }
  });
}

/****************************************************************************
 * 10) previewGroupAppend: Helper to append a preview item.
 ****************************************************************************/
function previewGroupAppend(buttonElement, mediaItem) {
  const uploadGroupElem = buttonElement.closest('.upload-group');
  const previewContainer = uploadGroupElem.querySelector('.upload-preview-container');
  previewContainer.appendChild(mediaItem);
}
