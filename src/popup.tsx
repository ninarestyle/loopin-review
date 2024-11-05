import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface ModalProps {
  onClose: () => void;
}

interface LoginModalProps {
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)'
  }}>
    <div style={{
      padding: '20px',
      background: '#FFF',
      borderRadius: '10px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
      zIndex: 1000,
      textAlign: 'center'
    }}>
      <img src="path/to/your/logo.png" alt="Logo" style={{ width: '100px', marginBottom: '20px' }} />
      <p>Please log in first.</p>
      <button onClick={onClose} style={{
        padding: '10px 20px',
        backgroundColor: '#BDEF51',
        border: 'none',
        color: 'white',
        borderRadius: '5px',
        cursor: 'pointer',
      }}>
        OK
      </button>
    </div>
  </div>
);

const Popup = () => {
  const [currentURL, setCurrentURL] = useState<string>("");
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        setCurrentURL(tabs[0].url);
      } else {
        setCurrentURL('No active tab');
      }
    });
  }, []);

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
  };

  function adjustImageToAspectRatio(imageSrc: string, backgroundColor: string = 'white'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get 2D context from canvas"));
          return;
        }

        // Define the target aspect ratio
        const targetAspectRatio = 4 / 3;

        let canvasWidth, canvasHeight;

        // Determine the canvas size to fit the image within the 4:3 ratio without cropping
        if (img.width / img.height > targetAspectRatio) {
          // Image is wider
          canvasWidth = img.width;
          canvasHeight = canvasWidth / targetAspectRatio;
          if (canvasHeight < img.height) {
            canvasHeight = img.height;
            canvasWidth = canvasHeight * targetAspectRatio;
          }
        } else {
          // Image is taller or perfectly fits the aspect ratio
          canvasHeight = img.height;
          canvasWidth = canvasHeight * targetAspectRatio;
          if (canvasWidth < img.width) {
            canvasWidth = img.width;
            canvasHeight = canvasWidth / targetAspectRatio;
          }
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Calculate position to center the image on the canvas
        const xOffset = (canvasWidth - img.width) / 2;  // Center the image horizontally
        const yOffset = (canvasHeight - img.height) / 2; // Center the image vertically

        // Fill the background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw the image in the center of the canvas
        ctx.drawImage(img, xOffset, yOffset, img.width, img.height);

        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, 'image/png');
      };

      img.onerror = (e) => reject(e);
      img.src = imageSrc;
    });
  }

  const isAuthenticated = async () => {
    return new Promise<boolean>((resolve) => {
      chrome.storage.local.get(['jwtToken'], (result) => {
        resolve(Boolean(result.jwtToken));
      });
    });
  };

  const handleLogin = () => {
    chrome.runtime.sendMessage({ action: "login" }, (response) => {
      console.log(response.status);  // Optional: Handle the response further if needed.
    });
  };

  const requestReview = async (url: string) => {
    if (!(await isAuthenticated())) {
      setShowLoginModal(true); // Show the custom login modal instead of alert
      handleLogin();
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      const result = await chrome.storage.local.get('jwtToken');
      const jwtToken = result?.jwtToken;

      if (tab) {
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, async (imageSrc) => {
          try {
            // Adjust image to 4:3 aspect ratio and convert to blob
            const imageBlob = await adjustImageToAspectRatio(imageSrc);
            // const imageBlob = dataURLtoBlob(imageSrc);
            const file = new File([imageBlob], "screenshot.png", { type: 'image/png' });
            const formData = new FormData();
            formData.append("files", file);

            const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/media/upload-media-files`, {
              method: "POST",
              body: formData,
              headers: {
                Authorization: `Bearer ${jwtToken}`,
              },
            });

            if (!uploadResponse.ok) throw new Error("Failed to upload screenshot");

            const uploadDataResponse = await uploadResponse.json();
            const data = uploadDataResponse?.data;
            const mediaUrls = data.payload?.urls;

            const userPostResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/posts/create`, {
              method: 'POST',
              body: JSON.stringify({
                type: 3,
                mediaUrls: mediaUrls,
                content: `Has anyone here purchased this ${url} before? I'd love to hear about your experience and how you liked it!`,
                title: "Seeking Insights!"
              }),
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`
              }
            });

            if (!userPostResponse.ok) throw new Error("Failed to create user post");

            setModalOpen(true); // Show the modal on success
          } catch (error) {
            console.error("Error in processing:", error);
          }
        });
      }
    });
    
  };

  const handleModalClose = () => {
    setModalOpen(false); // Hide the modal
  };

  // Inline Modal Component
  const Modal: React.FC<ModalProps> = ({ onClose }) => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.4)'
    }}>
      <div style={{
        padding: '20px',
        background: '#FFF',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}>
        <p>Post shared successfully!</p>
        <button onClick={onClose} style={{
          padding: '10px 20px',
          backgroundColor: '#BDEF51',
          border: 'none',
          color: 'white',
          borderRadius: '5px',
          cursor: 'pointer',
        }}>
          Close
        </button>
      </div>
    </div>
  );
  return (
    <>
      <button
        onClick={() => requestReview(currentURL)}
        style={{
          backgroundColor: "#BDEF51", // Assuming this is your shade of green
          color: "#000000", // Black color for the text
          margin: "10px",
          padding: "10px 20px", // Standard padding, adjust as necessary
          border: "none", // No border
          borderRadius: "20px", // Increased border radius for a more rounded appearance
          cursor: "pointer", // Cursor changes to a pointer when hovering over the button
          fontSize: "16px", // Font size, adjust as necessary
          fontWeight: "bold" // Bold text
        }}
      >
        Request Review
      </button>
      {isModalOpen && <Modal onClose={handleModalClose} />}
      {showLoginModal && <LoginModal onClose={handleCloseLoginModal} />}
    </>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
} else {
  console.error('Failed to find the root element');
}
