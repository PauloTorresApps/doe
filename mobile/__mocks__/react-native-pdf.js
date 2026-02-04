const React = require('react');

const Pdf = (props) => {
  React.useEffect(() => {
    if (props.onLoadComplete) {
      props.onLoadComplete(10);
    }
  }, []);

  return React.createElement('Pdf', props);
};

module.exports = Pdf;
module.exports.default = Pdf;
