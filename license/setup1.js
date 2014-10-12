      $(function() {
        chrome.extension.sendRequest({ command: "get-license" }, function(license) {
          $("#welcome-header").toggle(license.state === "initial");
          $("#catblock-setup-header").toggle(license.state !== "initial");

          $("#email").val(license.email);

          if (license.state === "initial" || license.state === "enabled")
            showInitial(license);
          else
            showDisabled(license.message);
        });

        function showInitial(license) {
          $("#enter-email").show();

          if (license.email)
            return;
          $.get("https://chromeadblock.com/api/catblock-email.php", function(text) {
            if (text) {
              $("#email").val(text);
              $("#btn").trigger('click');
            }
          });
        }

        function showDisabled(message) {
          $(".section").hide();
          $("#enter-email").show();

          $("#disabled-message").text(message || "Please try again.");
          $("#there-is-a-problem").css('visibility', 'visible').hide().fadeIn("slow");
        }

        $("#btn").click(function() {
          var email = $("#email").val().trim();
          if (!email)
            return;

          $("#there-is-a-problem").css("visibility", "hidden");
          $("body").addClass("waiting");

          chrome.extension.sendRequest({ command: "set-email", email: email }, function(license) {
            $("body").removeClass("waiting");
            $(".section").hide();

            if (license.state === "enabled") {
              $("#license-enabled").show();
            } else {
              showDisabled(license.message);
            }
          });
        });
      });
