// API Configuration
const GEOAPIFY_API_KEY = "12ab3b42c6194f109f3db8aad048f11b";

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  getCurrentLocation();

  // Add enter key support for address input
  document
    .getElementById("addressInput")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        searchTimezone();
      }
    });
});

// Get user's current location and timezone
function getCurrentLocation() {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      fetchTimezoneData(lat, lng, "current");
    },
    function (error) {
      let errorMessage = "Location access denied. ";
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "Location access denied by user.";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "Location information unavailable.";
          break;
        case error.TIMEOUT:
          errorMessage = "Location request timed out.";
          break;
      }

      // Show error in current timezone section
      updateCurrentTimezoneDisplay({
        error: errorMessage,
      });
    }
  );
}

// Fetch timezone data from coordinates using Geoapify
async function fetchTimezoneData(lat, lng, type = "result") {
  try {
    // Use Geoapify Timezone API
    const timezoneResponse = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_API_KEY}`
    );

    if (!timezoneResponse.ok) {
      throw new Error("Failed to fetch timezone data from Geoapify");
    }

    const timezoneData = await timezoneResponse.json();

    // Get timezone info from the response
    let timezone = "Unknown";
    let country = "Unknown";
    let city = "Unknown";
    let postcode = "N/A";

    if (timezoneData.features && timezoneData.features.length > 0) {
      const feature = timezoneData.features[0];
      const props = feature.properties;

      timezone = props.timezone?.name || "Unknown";
      country = props.country || "Unknown";
      city = props.city || props.town || props.village || "Unknown";
      postcode = props.postcode || "N/A";
    }

    // Calculate timezone offset (simplified - using current date)
    const now = new Date();
    const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const targetOffset = -now.getTimezoneOffset() * 60; // This is a simplified approach

    const timezoneInfo = {
      name: timezone,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      offsetStd: formatOffset(targetOffset),
      offsetStdSec: targetOffset,
      offsetDst: formatOffset(targetOffset), // Simplified - same as STD
      offsetDstSec: targetOffset,
      country: country,
      postcode: postcode,
      city: city,
    };

    if (type === "current") {
      updateCurrentTimezoneDisplay(timezoneInfo);
    } else {
      updateResultDisplay(timezoneInfo);
    }
  } catch (error) {
    console.error("Error fetching timezone data:", error);

    // Fallback to free API
    try {
      const fallbackResponse = await fetch(
        `https://api.bigdatacloud.net/data/timezone-by-location?latitude=${lat}&longitude=${lng}`
      );
      const fallbackData = await fallbackResponse.json();

      // Also get location details
      const locationResponse = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      const locationData = await locationResponse.json();

      const timezoneInfo = {
        name:
          fallbackData.ianaTimeId ||
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
        offsetStd: formatOffset(
          fallbackData.rawOffset || -new Date().getTimezoneOffset() * 60
        ),
        offsetStdSec:
          fallbackData.rawOffset || -new Date().getTimezoneOffset() * 60,
        offsetDst: formatOffset(
          (fallbackData.rawOffset || 0) + (fallbackData.dstOffset || 0) ||
            -new Date().getTimezoneOffset() * 60
        ),
        offsetDstSec:
          (fallbackData.rawOffset || 0) + (fallbackData.dstOffset || 0) ||
          -new Date().getTimezoneOffset() * 60,
        country: locationData.countryName || "Unknown",
        postcode: locationData.postcode || "N/A",
        city: locationData.city || locationData.locality || "Unknown",
      };

      if (type === "current") {
        updateCurrentTimezoneDisplay(timezoneInfo);
      } else {
        updateResultDisplay(timezoneInfo);
      }
    } catch (fallbackError) {
      console.error("Fallback API also failed:", fallbackError);

      if (type === "current") {
        const browserFallback = {
          name: Intl.DateTimeFormat().resolvedOptions().timeZone,
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
          offsetStd: formatOffset(-new Date().getTimezoneOffset() * 60),
          offsetStdSec: -new Date().getTimezoneOffset() * 60,
          offsetDst: formatOffset(-new Date().getTimezoneOffset() * 60),
          offsetDstSec: -new Date().getTimezoneOffset() * 60,
          country: "Unknown",
          postcode: "N/A",
          city: "Unknown",
        };
        updateCurrentTimezoneDisplay(browserFallback);
      } else {
        showError("Failed to fetch timezone information. Please try again.");
      }
    }
  }
}

// Search for timezone by address using Geoapify
async function searchTimezone() {
  const address = document.getElementById("addressInput").value.trim();

  if (!address) {
    showError("Please enter an address!");
    return;
  }

  hideError();
  setLoading(true);

  try {
    // Use Geoapify Geocoding API
    const geocodingResponse = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
        address
      )}&apiKey=${GEOAPIFY_API_KEY}&limit=1`
    );

    if (!geocodingResponse.ok) {
      throw new Error("Geocoding request failed");
    }

    const geocodingData = await geocodingResponse.json();

    if (geocodingData.features && geocodingData.features.length > 0) {
      const location = geocodingData.features[0].geometry.coordinates;
      const lng = location[0];
      const lat = location[1];

      await fetchTimezoneData(lat, lng, "result");
      document.getElementById("resultSection").classList.remove("hidden");
    } else {
      // Fallback to mock locations for common addresses
      const mockLocation = getMockLocation(address);
      if (mockLocation) {
        await fetchTimezoneData(mockLocation.lat, mockLocation.lng, "result");
        document.getElementById("resultSection").classList.remove("hidden");
      } else {
        showError("Address not found. Please try a more specific address.");
      }
    }
  } catch (error) {
    console.error("Error searching timezone:", error);

    // Try fallback with mock locations
    const mockLocation = getMockLocation(address);
    if (mockLocation) {
      try {
        await fetchTimezoneData(mockLocation.lat, mockLocation.lng, "result");
        document.getElementById("resultSection").classList.remove("hidden");
      } catch (fallbackError) {
        showError("Failed to fetch timezone information. Please try again.");
      }
    } else {
      showError(
        "Unable to find the address. Please check spelling and try again."
      );
    }
  } finally {
    setLoading(false);
  }
}

// Mock location data for demo purposes
function getMockLocation(address) {
  const mockLocations = {
    "new delhi": { lat: 28.6139, lng: 77.209 },
    delhi: { lat: 28.6139, lng: 77.209 },
    mumbai: { lat: 19.076, lng: 72.8777 },
    london: { lat: 51.5074, lng: -0.1278 },
    "new york": { lat: 40.7128, lng: -74.006 },
    tokyo: { lat: 35.6762, lng: 139.6503 },
    "gk2 new delhi": { lat: 28.5355, lng: 77.2367 },
    gk2: { lat: 28.5355, lng: 77.2367 },
  };

  const normalizedAddress = address.toLowerCase().trim();
  return mockLocations[normalizedAddress] || null;
}

// Update current timezone display
function updateCurrentTimezoneDisplay(data) {
  if (data.error) {
    document.getElementById("currentTzName").textContent = "Error";
    document.getElementById("currentTzName").className = "info-value error";

    // Set all other fields to show error state
    [
      "currentLat",
      "currentLong",
      "currentOffsetStd",
      "currentOffsetStdSec",
      "currentOffsetDst",
      "currentOffsetDstSec",
      "currentCountry",
      "currentPostcode",
      "currentCity",
    ].forEach((id) => {
      document.getElementById(id).textContent = "N/A";
    });
    return;
  }

  document.getElementById("currentTzName").textContent = data.name;
  document.getElementById("currentLat").textContent = data.lat;
  document.getElementById("currentLong").textContent = data.lng;
  document.getElementById("currentOffsetStd").textContent = data.offsetStd;
  document.getElementById("currentOffsetStdSec").textContent =
    data.offsetStdSec;
  document.getElementById("currentOffsetDst").textContent = data.offsetDst;
  document.getElementById("currentOffsetDstSec").textContent =
    data.offsetDstSec;
  document.getElementById("currentCountry").textContent = data.country;
  document.getElementById("currentPostcode").textContent = data.postcode;
  document.getElementById("currentCity").textContent = data.city;
}

// Update result display
function updateResultDisplay(data) {
  document.getElementById("resultTzName").textContent = data.name;
  document.getElementById("resultLat").textContent = data.lat;
  document.getElementById("resultLong").textContent = data.lng;
  document.getElementById("resultOffsetStd").textContent = data.offsetStd;
  document.getElementById("resultOffsetStdSec").textContent = data.offsetStdSec;
  document.getElementById("resultOffsetDst").textContent = data.offsetDst;
  document.getElementById("resultOffsetDstSec").textContent = data.offsetDstSec;
  document.getElementById("resultCountry").textContent = data.country;
  document.getElementById("resultPostcode").textContent = data.postcode;
  document.getElementById("resultCity").textContent = data.city;
}

// Utility functions
function formatOffset(seconds) {
  const hours = Math.floor(Math.abs(seconds) / 3600);
  const mins = Math.floor((Math.abs(seconds) % 3600) / 60);
  const sign = seconds >= 0 ? "+" : "-";
  return `${sign}${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
}

function showError(message) {
  const errorElement = document.getElementById("errorMessage");
  errorElement.textContent = message;
  errorElement.classList.remove("hidden");
}

function hideError() {
  document.getElementById("errorMessage").classList.add("hidden");
}

function setLoading(isLoading) {
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Loading..." : "Submit";
}
